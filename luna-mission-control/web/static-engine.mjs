/** Browser-only LUNA demonstration. Never treat output as NASA-validated data. */
const PI=Math.PI,rad=PI/180,epoch=Date.parse('2026-11-20T00:00:00Z'),HOUR=3600000;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),round=(x,d=2)=>Number(x.toFixed(d)),iso=x=>new Date(x).toISOString();
function validated(input){
  const r={...input},numeric=['latitude','longitude','duration_days','area_m2','panel_tilt_deg','panel_az_deg','battery_wh','load_w','reserve_percent'];
  for(const k of numeric)r[k]=Number(r[k]);
  if(!Number.isFinite(Date.parse(r.landing_time)))throw Error('Invalid UTC landing time');
  const limits={latitude:[-90,90],longitude:[-180,180],duration_days:[1,21],area_m2:[.01,100],panel_tilt_deg:[0,90],panel_az_deg:[0,360],battery_wh:[1,500000],load_w:[.01,5000],reserve_percent:[0,90]};
  for(const [k,[lo,hi]] of Object.entries(limits))if(!Number.isFinite(r[k])||r[k]<lo||r[k]>hi)throw Error('Invalid '+k);
  if(r.data_mode&&r.data_mode!=='demo')throw Error('GitHub Pages offers offline illustrative geometry only. Live JPL Horizons requires the Python backend.');
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
  const start=Date.parse(r.landing_time),N=r.duration_days*24;
  const gs=Array.from({length:N+1},(_,i)=>demoGeometry(r.latitude,r.longitude,start+i*HOUR));
  return simulateWithGeometry(r,gs,"OFFLINE ILLUSTRATIVE GEOMETRY");
}

export function simulateWithGeometry(input,gs,ephemerisLabel,terrainInfo=null,regionalHorizon=null){
  // Only a validated and continuous NASA/JPL series should pass in a JPL label.
  const r=validated({...input,data_mode:"demo"}),start=Date.parse(r.landing_time),N=r.duration_days*24;
  if(!Array.isArray(gs)||gs.length!==N+1||gs[0].time!==iso(start)||gs.at(-1).time!==iso(start+N*HOUR)){
    throw Error("Ephemeris series does not fully cover the selected mission");
  }
  let energy=r.battery_wh*.9,firstViolation=null;
  const rows=[];
  for(let i=0;i<=N;i++){
    const g=gs[i],fraction=solarVisibility(g,regionalHorizon),power=photovoltaicPower(g,r,fraction),time=iso(start+i*HOUR);
    rows.push({time,hours:i,sun_az:round(g.sun_az),sun_el:round(g.sun_el),earth_az:round(g.earth_az),earth_el:round(g.earth_el),
      power_w:round(power),sun_visible:fraction>0,earth_visible:earthVisibility(g,regionalHorizon),solar_fraction:round(fraction,3),
      solar_irradiance_w_m2:g.sun_distance_km?round(solarIrradiance(g.sun_distance_km)):REFERENCE_SOLAR_IRRADIANCE,
      battery_wh:round(energy),soc:round(100*energy/r.battery_wh),temperature_proxy_c:null});
    if(firstViolation===null&&energy<r.battery_wh*r.reserve_percent/100)firstViolation=time;
    if(i===N)break;
    const next=gs[i+1],nextP=photovoltaicPower(next,r,solarVisibility(next,regionalHorizon));
    const net=(power+nextP)/2-r.load_w;
    energy=clamp(energy+(net>=0?net*.95:net/.9),0,r.battery_wh);
    // Spacecraft temperature cannot be inferred from Sun elevation alone.
    // NASA Diviner measures regolith brightness temperatures, not component
    // temperatures for this unspecified lander.

  }
  const earth=windows(rows,'earth_visible'),sun=windows(rows,'sun_visible');
  const sum=rows.slice(0,-1).reduce((n,g,i)=>n+(g.power_w+rows[i+1].power_w)/2,0);
  const minSoc=Math.min(...rows.map(x=>x.soc)),reserveOk=minSoc>=r.reserve_percent,commsOk=earth.maxGap<=24;
  return {site:{latitude:r.latitude,longitude:r.longitude},landing_time:r.landing_time,duration_days:r.duration_days,
    terrain:terrainInfo,regional_horizon:regionalHorizon?.coverage?{
      max_obstruction_deg:round(Math.max(...regionalHorizon.horizon),2),
      max_range_km:regionalHorizon.max_range_km,
      angular_resolution_deg:regionalHorizon.bearing_step_deg,
      near_field_resolved:false
    }:null,
    quality:{
      ephemeris:ephemerisLabel,
      irradiance:'NASA/JPL Sun distance + 1361 W/m² reference; panel efficiency/tilt/load are assumptions',
      terrain:regionalHorizon?.coverage?'NASA LOLA COARSE REGIONAL OBSTRUCTION: NO FINE HORIZON VALIDATION':
        terrainInfo?.coverage?'NASA LOLA REGIONAL ELEVATION ONLY; HORIZON UNAVAILABLE':'LOLA TERRAIN UNAVAILABLE — GEOMETRIC HORIZON',
      temperature:'SPACECRAFT THERMAL FORECAST UNAVAILABLE — NASA DIVINER MEASURES REGOLITH, NOT THIS LANDER',
      seismic:'NO LOCATION-SPECIFIC SEISMIC HAZARD PREDICTION',
      rover:'NO ROVER TRAVERSABILITY DETERMINED'
    },
    metrics:{total_energy_wh:Math.round(sum),sun_hours:sun.hours,earth_hours:earth.hours,earth_fraction:round(earth.hours/N,3),
      max_earth_blackout_h:earth.maxGap,max_darkness_h:sun.maxGap,min_soc:round(minSoc,1),
      battery_reserve_pass:reserveOk,communication_pass:commsOk,feasible:reserveOk&&commsOk,
      constraints_label:'Assumption-based battery reserve and arbitrary 24-hour communication gap checks; NOT certified safe',
      first_reserve_violation:firstViolation},
    earth_windows:earth.intervals,sun_windows:sun.intervals,samples:rows};
}
const grid=[[-89.5,0],[-89.5,45],[-89.5,90],[-89.5,135],[-89.5,-90],[-89.1,15],[-89.1,75],[-89.1,145],[-88.5,-35],[-88.5,55],[-88.5,135]];
function rank(out,r){
  const m=out.metrics,possible=1361*r.area_m2*.24*.8*r.duration_days*24;
  return [Number(m.feasible),round(.6*Math.min(1,m.total_energy_wh/Math.max(1,possible))+.4*m.earth_fraction,6),m.min_soc];
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
    scientific_limit:'Geometric Earth visibility only. NASA terrain and actual landing safety are not evaluated.'};
}
export async function staticApi(path,body){
  await Promise.resolve();
  if(path==='preview')return preview(body);
  if(path==='simulate')return simulate(body);
  if(path==='optimize')return optimize(body);
  throw Error('Unsupported static endpoint: '+path);
}
