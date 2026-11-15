/** Browser LUNA mission engine: NASA-derived geometry, engineering projections. */
import {projectRegolithTemperatureC,powerConservationFlag,THERMAL_PROVENANCE} from './thermal-projection.mjs';
import {thermalParameters,radioParameters,thermalStep,radioLinkBudget} from './engineering-models.mjs';
const PI=Math.PI,rad=PI/180,epoch=Date.parse('2026-11-20T00:00:00Z'),HOUR=3600000;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),round=(x,d=2)=>Number(x.toFixed(d)),iso=x=>new Date(x).toISOString();
function validated(input){
  const r={...input},numeric=['latitude','longitude','duration_days','area_m2','panel_tilt_deg','panel_az_deg','battery_wh','load_w','reserve_percent'];
  for(const k of numeric)r[k]=Number(r[k]);
  if(!Number.isFinite(Date.parse(r.landing_time)))throw Error('Invalid UTC landing time');
  r.sample_minutes=Number(r.sample_minutes??30);
  if(![15,30,60].includes(r.sample_minutes))throw Error('Invalid time step; choose 15, 30 or 60 minutes');
  const limits={latitude:[-90,90],longitude:[-180,180],duration_days:[1,35],area_m2:[.01,100],panel_tilt_deg:[0,90],panel_az_deg:[0,360],battery_wh:[1,500000],load_w:[.01,5000],reserve_percent:[0,90]};
  for(const [k,[lo,hi]] of Object.entries(limits))if(!Number.isFinite(r[k])||r[k]<lo||r[k]>hi)throw Error('Invalid '+k);
  if(r.data_mode&&r.data_mode!=='demo')throw Error('GitHub Pages offers offline illustrative geometry only. Live JPL Horizons requires the Python backend.');
  Object.assign(r,thermalParameters(r),radioParameters(r));
  if(!Number.isInteger(r.duration_days))throw Error('Duration must be a whole number of days');
  r.landing_time=iso(r.landing_time);return r;
}
function azel(lat,lon,dec,sub){
  let p=lat*rad,d=dec*rad,delta=(sub-lon)*rad;
  const el=Math.asin(clamp(Math.sin(p)*Math.sin(d)+Math.cos(p)*Math.cos(d)*Math.cos(delta),-1,1))/rad;
  const az=(Math.atan2(Math.sin(delta)*Math.cos(d),Math.cos(p)*Math.sin(d)-Math.sin(p)*Math.cos(d)*Math.cos(delta))/rad+360)%360;
  return [az,el];
}
// Global Moon-fixed body directions. This frame has +Y at lunar north,
// +Z toward the zero-longitude equator and +X toward 90° east.
// A direction depends only on UTC time, NEVER on the selected landing site.
export function moonFixedDirections(time){
  const days=(new Date(time).getTime()-epoch)/86400000;
  const sun_sub_lon_deg=(12.19*days)%360;
  const sun_sub_lat_deg=1.54*Math.sin(2*PI*days/365.25);
  const earth_sub_lon_deg=6.5*Math.sin(2*PI*days/27.32);
  const earth_sub_lat_deg=5.8*Math.sin(2*PI*days/27.2-.7);
  const vector=(latitude,longitude)=>{
    const p=latitude*rad,l=longitude*rad;
    return {x:Math.cos(p)*Math.sin(l),y:Math.sin(p),z:Math.cos(p)*Math.cos(l)};
  };
  return {
    sun:vector(sun_sub_lat_deg,sun_sub_lon_deg),
    earth:vector(earth_sub_lat_deg,earth_sub_lon_deg),
    sun_sub_lon_deg,sun_sub_lat_deg,earth_sub_lon_deg,earth_sub_lat_deg
  };
}
export function demoGeometry(lat,lon,time){
  const fixed=moonFixedDirections(time);
  const [sun_az,sun_el]=azel(lat,lon,fixed.sun_sub_lat_deg,fixed.sun_sub_lon_deg);
  const [earth_az,earth_el]=azel(lat,lon,fixed.earth_sub_lat_deg,fixed.earth_sub_lon_deg);
  return {time:iso(time),sun_az,sun_el,earth_az,earth_el};
}
export function solarDiskFraction(clearance,radius=.266){
  const x=clearance/radius;
  if(x<=-1)return 0;if(x>=1)return 1;
  return (Math.acos(-x)+x*Math.sqrt(Math.max(0,1-x*x)))/PI;
}
// NASA/JPL Horizons Sun-distance correction. 1361 W/m² is a reference
// total solar irradiance at exactly 1 astronomical unit, not a guarantee of
// electrical output for any particular spacecraft.
export const AU_KM=149597870.700;
export const REFERENCE_SOLAR_IRRADIANCE=1361;
export function solarIrradiance(distanceKm){
  if(!Number.isFinite(distanceKm)||distanceKm<1.3e8||distanceKm>1.7e8)throw Error("Sun distance is missing or outside expected lunar orbit range");
  return REFERENCE_SOLAR_IRRADIANCE*(AU_KM/distanceKm)**2;
}
export function photovoltaicPower(g,r,visibleFraction){
  const e=g.sun_el*rad,b=r.panel_tilt_deg*rad,d=(g.sun_az-r.panel_az_deg)*rad;
  const incidence=Math.max(0,Math.sin(e)*Math.cos(b)+Math.cos(e)*Math.sin(b)*Math.cos(d));
  // 24% module conversion and 80% balance-of-system factor are user-facing
  // design assumptions, not measurements of an unspecified lunar lander.
  const irradiance=g.sun_distance_km?solarIrradiance(g.sun_distance_km):REFERENCE_SOLAR_IRRADIANCE;
  return irradiance*r.area_m2*.24*.8*incidence*visibleFraction;
}
export function solarVisibility(g,horizon=null){
  const theta=horizon?.coverage ? horizonAngleAt(horizon,g.sun_az) : 0;
  const radius=g.sun_distance_km? Math.asin(Math.min(1,695700/g.sun_distance_km))/rad : .266;
  return solarDiskFraction(g.sun_el-theta,radius);
}
export function earthVisibility(g,horizon=null){
  // Earth's CENTER above coarse regional obstruction, not a radio-link budget.
  const theta=horizon?.coverage?horizonAngleAt(horizon,g.earth_az):0;
  return g.earth_el>theta;
}
export function horizonAngleAt(horizon,az){
  if(!horizon||!horizon.coverage||!Array.isArray(horizon.horizon))return 0;
  const a=horizon.horizon,n=a.length,x=((az%360+360)%360)*n/360;
  const i=Math.floor(x),f=x-i;
  return (1-f)*a[i%n]+f*a[(i+1)%n];
}

function windows(rows,key){
  let intervals=[],open=null,hours=0,maxGap=0,gap=0;
  for(let i=0;i<rows.length-1;i++){
    const dt=rows[i+1].hours-rows[i].hours;
    if(rows[i][key]){hours+=dt;maxGap=Math.max(maxGap,gap);gap=0;if(open===null)open=i}
    else{gap+=dt;if(open!==null){intervals.push({start:rows[open].time,end:rows[i].time,hours:round(rows[i].hours-rows[open].hours)});open=null}}
  }
  maxGap=Math.max(maxGap,gap);
  if(open!==null){const end=rows.at(-1);intervals.push({start:rows[open].time,end:end.time,hours:round(end.hours-rows[open].hours)})}
  return {intervals,hours:round(hours,1),maxGap:round(maxGap)};
}
export function preview(input){
  const r=validated(input),g=demoGeometry(r.latitude,r.longitude,r.landing_time);
  return {source:'OFFLINE ILLUSTRATIVE — NOT NASA EPHEMERIS',global_source:'Moon-fixed demo directions — not measured ephemerides',global:moonFixedDirections(r.landing_time),sun_az:round(g.sun_az),sun_el:round(g.sun_el),earth_az:round(g.earth_az),earth_el:round(g.earth_el)};
}
export function simulate(input){
  const r=validated(input);
  const dt=r.sample_minutes/60,stepMs=r.sample_minutes*60000;
  const start=Date.parse(r.landing_time),N=Math.round(r.duration_days*24/dt);
  const gs=Array.from({length:N+1},(_,i)=>demoGeometry(r.latitude,r.longitude,start+i*stepMs));
  return simulateWithGeometry(r,gs,"OFFLINE ILLUSTRATIVE GEOMETRY");
}

export function simulateWithGeometry(input,gs,ephemerisLabel,terrainInfo=null,regionalHorizon=null){
  // Only a validated and continuous NASA/JPL series should pass in a JPL label.
  const r=validated({...input,data_mode:"demo"}),start=Date.parse(r.landing_time),
        dt=r.sample_minutes/60,stepMs=r.sample_minutes*60000,N=Math.round(r.duration_days*24/dt);
  if(!Array.isArray(gs)||gs.length!==N+1||gs[0].time!==iso(start)||gs.at(-1).time!==iso(start+N*stepMs)){
    throw Error("Ephemeris series does not fully cover the selected mission");
  }
  let energy=r.battery_wh*.9,firstViolation=null,landerTempK=r.initial_temp_c+273.15;
  let heaterEnergyWh=0;
  const rows=[];
  for(let i=0;i<=N;i++){
    const g=gs[i],fraction=solarVisibility(g,regionalHorizon),power=photovoltaicPower(g,r,fraction),time=iso(start+i*stepMs);
    const irradiance=g.sun_distance_km?solarIrradiance(g.sun_distance_km):REFERENCE_SOLAR_IRRADIANCE;
    const regolithC=projectRegolithTemperatureC(irradiance,g.sun_el,fraction);
    const geometricEarth=earthVisibility(g,regionalHorizon);
    const earthTerrainAngle=regionalHorizon?.coverage?horizonAngleAt(regionalHorizon,g.earth_az):0;
    const earthClearanceDeg=g.earth_el-earthTerrainAngle;
    const link=g.earth_distance_km?radioLinkBudget(g.earth_distance_km,r):null;
    const step=i<N?thermalStep(landerTempK,regolithC,irradiance,fraction,r.load_w,r,energy>0,r.sample_minutes*60):null;
    const landerTempC=landerTempK-273.15;
    rows.push({time,hours:i*dt,sun_az:round(g.sun_az),sun_el:round(g.sun_el),earth_az:round(g.earth_az),earth_el:round(g.earth_el),
      power_w:round(power),sun_visible:fraction>0,earth_visible:geometricEarth,earth_clearance_deg:round(earthClearanceDeg,2),solar_fraction:round(fraction,3),
      solar_irradiance_w_m2:round(irradiance),
      battery_wh:round(energy),soc:round(100*energy/r.battery_wh),diviner_observed_c:null,
      temperature_proxy_c:regolithC,
      temperature_status:'PROJECTED REGOLITH RADIATIVE EQUILIBRIUM — NOT VALIDATED',
      lander_temperature_c:round(landerTempC),
      lander_temperature_status:'PROJECTED ONE-NODE THERMAL HARDWARE — NOT FLIGHT VALIDATED',
      heater_w:round(step?.average_heater_w??0),
      thermal_screen_flag:landerTempC<r.operational_min_c||landerTempC>r.operational_max_c,
      rf_margin_db:link?round(link.margin_db):null,
      rf_link_available:link?Boolean(geometricEarth&&link.passes_assumed_budget):null,
      earth_range_km:Number.isFinite(g.earth_distance_km)?round(g.earth_distance_km):null,
      power_conservation_advisory:powerConservationFlag(100*energy/r.battery_wh,r.reserve_percent,power,r.load_w+(step?.average_heater_w??0))});
    if(firstViolation===null&&energy<r.battery_wh*r.reserve_percent/100)firstViolation=time;
    if(i===N)break;
    const next=gs[i+1],nextP=photovoltaicPower(next,r,solarVisibility(next,regionalHorizon));
    const heaterW=step.average_heater_w;
    heaterEnergyWh+=step.heater_energy_wh;
    const net=(power+nextP)/2-r.load_w-heaterW;
    energy=clamp(energy+(net>=0?net*.95:net/.9)*dt,0,r.battery_wh);
    landerTempK=step.temp_k;

  }
  const earth=windows(rows,'earth_visible'),sun=windows(rows,'sun_visible');
  const linkWindows=rows.every(x=>x.rf_link_available!==null)?windows(rows,'rf_link_available'):null;
  const sum=rows.slice(0,-1).reduce((n,g,i)=>n+(g.power_w+rows[i+1].power_w)/2*dt,0);
  const minSoc=Math.min(...rows.map(x=>x.soc)),reserveOk=minSoc>=r.reserve_percent;
  // In NASA mode use the assumed RF budget; demo mode has geometry only.
  const commsOk=(linkWindows??earth).maxGap<=24;
  return {site:{latitude:r.latitude,longitude:r.longitude},landing_time:r.landing_time,duration_days:r.duration_days,
    terrain:terrainInfo,regional_horizon:regionalHorizon?.coverage?{
      max_obstruction_deg:round(Math.max(...regionalHorizon.horizon),2),
      max_range_km:regionalHorizon.max_range_km,
      angular_resolution_deg:regionalHorizon.bearing_step_deg,
      near_field_resolved:regionalHorizon.near_field_resolved===true,
      detail_resolution_m:regionalHorizon.detail_resolution_m??null
    }:null,
    quality:{
      ephemeris:ephemerisLabel,
      irradiance:'NASA/JPL Sun distance + 1361 W/m² reference; panel efficiency/tilt/load are assumptions',
      terrain:regionalHorizon?.detail_resolution_m?'NASA LOLA LOCAL 20-METER DEM + COARSE DISTANT HORIZON; NOT LANDING CERTIFICATION':
        regionalHorizon?.coverage?'NASA LOLA COARSE REGIONAL OBSTRUCTION: NO FINE HORIZON VALIDATION':
        terrainInfo?.coverage?'NASA LOLA REGIONAL ELEVATION ONLY; HORIZON UNAVAILABLE':'LOLA TERRAIN UNAVAILABLE — GEOMETRIC HORIZON',
      temperature:'PROJECTED REGOLITH EQUILIBRIUM — Diviner context, NOT calibrated to site or spacecraft',
      thermal_provenance:THERMAL_PROVENANCE,
      solar_power:'PROJECTED from JPL Horizons illumination and Sun distance, LOLA regional obstruction, and assumed panel geometry/efficiency',
      battery:'PROJECTED SOC from spacecraft capacity/load/efficiency assumptions, not validated hardware',
      communication:linkWindows?
        'PROJECTED S-BAND RF LINK MARGIN: NASA Earth range + assumed transmitter, antenna, noise, data rate and losses; NO ground station visibility/scheduling':
        'GEOMETRIC EARTH VISIBILITY ONLY — no ephemeris distance or RF budget',
      radio_assumptions:{frequency_ghz:r.rf_frequency_ghz,transmitter_w:r.rf_tx_w,
        antenna_gain_dbi:r.rf_tx_gain_dbi,ground_gt_db_k:r.rf_ground_gt_dbk,
        data_rate_bps:r.rf_bitrate_bps,loss_db:r.rf_loss_db,
        required_ebn0_db:r.rf_required_ebn0_db,required_margin_db:r.rf_required_margin_db},
      lander_thermal:'PROJECTED ONE-NODE HARDWARE ENERGY BALANCE (NASA HLS thermal-guide method); ASSUMED insulation/radiator/inertia/heater; NOT VALIDATED',
      thermal_assumptions:{thermal_capacity_j_k:r.thermal_capacity_j_k,radiator_area_m2:r.radiator_area_m2,
        heater_max_w:r.heater_w,heater_setpoint_c:r.heater_setpoint_c,
        operational_min_c:r.operational_min_c,operational_max_c:r.operational_max_c},
      validation:'NASA inputs verified for units and coverage; modeled predictions NOT independently validated for mission operations',
      seismic:'NO LOCATION-SPECIFIC SEISMIC HAZARD PREDICTION',
      rover:'NO ROVER TRAVERSABILITY DETERMINED'
    },
    metrics:{total_energy_wh:Math.round(sum),sun_hours:sun.hours,earth_hours:earth.hours,earth_fraction:round(earth.hours/N,3),
      max_earth_blackout_h:earth.maxGap,max_darkness_h:sun.maxGap,min_soc:round(minSoc,1),
      battery_reserve_pass:reserveOk,communication_pass:commsOk,feasible:reserveOk&&commsOk,
      constraints_label:'Assumption-based battery reserve and arbitrary 24-hour communication gap checks; NOT certified safe',
      first_reserve_violation:firstViolation,
      predicted_rf_link_hours:linkWindows?.hours??null,
      predicted_rf_max_outage_h:linkWindows?.maxGap??null,
      min_rf_margin_db:linkWindows?round(Math.min(...rows.filter(x=>x.rf_margin_db!==null).map(x=>x.rf_margin_db))):null,
      heater_consumption_wh:round(heaterEnergyWh),
      lander_temperature_min_c:round(Math.min(...rows.map(x=>x.lander_temperature_c)),1),
      lander_temperature_max_c:round(Math.max(...rows.map(x=>x.lander_temperature_c)),1),
      thermal_screen_hours:round(rows.slice(0,-1).filter(x=>x.thermal_screen_flag).length*dt,2),
      power_conservation_hours:round(rows.slice(0,-1).filter(x=>x.power_conservation_advisory).length*dt,2),
      projected_temperature_min_c:Math.min(...rows.map(x=>x.temperature_proxy_c)),
      projected_temperature_max_c:Math.max(...rows.map(x=>x.temperature_proxy_c))},
    sample_minutes:r.sample_minutes,earth_windows:earth.intervals,sun_windows:sun.intervals,rf_link_windows:linkWindows?.intervals??null,samples:rows};
}
const grid=[[-89.5,0],[-89.5,45],[-89.5,90],[-89.5,135],[-89.5,-90],[-89.1,15],[-89.1,75],[-89.1,145],[-88.5,-35],[-88.5,55],[-88.5,135]];
function rank(out,r){
  const m=out.metrics,possible=1361*r.area_m2*.24*.8*r.duration_days*24;
  const rfFraction=m.predicted_rf_link_hours===null?m.earth_fraction:m.predicted_rf_link_hours/(r.duration_days*24);
  return [Number(m.feasible),round(.6*Math.min(1,m.total_energy_wh/Math.max(1,possible))+.4*rfFraction,6),m.min_soc];
}
export function optimize(payload){
  return optimizeWithEngine(payload,simulate);
}

export function optimizeWithEngine(payload,runner){
  const r=validated({...payload.mission,data_mode:"demo"}),original=runner(r),choices=[];
  if(payload.preserve==='time'){
    grid.forEach(([latitude,longitude],i)=>{if(latitude!==r.latitude||longitude!==r.longitude)choices.push({name:'Grid '+(i+1),request:{...r,latitude,longitude}})});
  }else if(payload.preserve==='site'){
    for(let j=-28;j<=28;j++)if(j!==0)choices.push({name:(j>=0?'+':'')+(j*12)+' h',request:{...r,landing_time:iso(Date.parse(r.landing_time)+j*12*HOUR)}});
  }else throw Error('preserve must be site or time');
  const sorted=choices.map(c=>({...c,result:runner(c.request)})).sort((a,b)=>{
    const x=rank(a.result,r),y=rank(b.result,r);return y[0]-x[0]||y[1]-x[1]||y[2]-x[2];
  });
  const winner=sorted[0],feasible=sorted.some(c=>c.result.metrics.feasible);
  return {original,recommended:winner?.result??null,recommendation_name:winner?.name??null,
    alternatives:sorted.slice(0,5).map(c=>({name:c.name,site:c.result.site,landing_time:c.result.landing_time,metrics:c.result.metrics})),
    preserve:payload.preserve,
    search:payload.preserve==='time'?'Demonstration grid of 11 south-pole coordinates; not vetted landing zones.':'Fixed site; landing dates sampled every 12 hours within ±14 days.',
    comparison_note:feasible?'Candidate passes assumed battery and communication thresholds, NOT landing safety.':'No evaluated candidate passes assumption-based battery and 24-hour blackout checks. This is NOT landing safety certification.',
    scientific_limit:'NASA Horizons and coarse LOLA inform projections; landing safety, lander thermal survival, and RF links remain unvalidated.'};
}
export async function staticApi(path,body){
  await Promise.resolve();
  if(path==='preview')return preview(body);
  if(path==='simulate')return simulate(body);
  if(path==='optimize')return optimize(body);
  throw Error('Unsupported static endpoint: '+path);
}
