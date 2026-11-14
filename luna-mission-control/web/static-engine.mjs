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
export function demoGeometry(lat,lon,time){
  const days=(new Date(time).getTime()-epoch)/86400000,solarLon=12.19*days%360,solarDec=1.54*Math.sin(2*PI*days/365.25);
  const earthLon=6.5*Math.sin(2*PI*days/27.32),earthDec=5.8*Math.sin(2*PI*days/27.2-.7);
  const [sun_az,sun_el]=azel(lat,lon,solarDec,solarLon),[earth_az,earth_el]=azel(lat,lon,earthDec,earthLon);
  return {time:iso(time),sun_az,sun_el,earth_az,earth_el};
}
export function solarDiskFraction(clearance,radius=.266){
  const x=clearance/radius;
  if(x<=-1)return 0;if(x>=1)return 1;
  return (Math.acos(-x)+x*Math.sqrt(Math.max(0,1-x*x)))/PI;
}
export function photovoltaicPower(g,r,f){
  const e=g.sun_el*rad,b=r.panel_tilt_deg*rad,d=(g.sun_az-r.panel_az_deg)*rad;
  return 1361*r.area_m2*.24*.8*f*Math.max(0,Math.sin(e)*Math.cos(b)+Math.cos(e)*Math.sin(b)*Math.cos(d));
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
  return {source:'OFFLINE ILLUSTRATIVE — NOT NASA EPHEMERIS',sun_az:round(g.sun_az),sun_el:round(g.sun_el),earth_az:round(g.earth_az),earth_el:round(g.earth_el)};
}
export function simulate(input){
  const r=validated(input),start=Date.parse(r.landing_time),N=r.duration_days*24;
  const gs=Array.from({length:N+1},(_,i)=>demoGeometry(r.latitude,r.longitude,start+i*HOUR));
  let energy=r.battery_wh*.9,temp=-75,firstViolation=null;
  const rows=[];
  for(let i=0;i<=N;i++){
    const g=gs[i],fraction=solarDiskFraction(g.sun_el),power=photovoltaicPower(g,r,fraction),time=iso(start+i*HOUR);
    rows.push({time,hours:i,sun_az:round(g.sun_az),sun_el:round(g.sun_el),earth_az:round(g.earth_az),earth_el:round(g.earth_el),
      power_w:round(power),sun_visible:fraction>0,earth_visible:g.earth_el>0,solar_fraction:round(fraction,3),
      battery_wh:round(energy),soc:round(100*energy/r.battery_wh),temperature_proxy_c:round(temp)});
    if(firstViolation===null&&energy<r.battery_wh*r.reserve_percent/100)firstViolation=time;
    if(i===N)break;
    const next=gs[i+1],nextP=photovoltaicPower(next,r,solarDiskFraction(next.sun_el));
    const net=(power+nextP)/2-r.load_w;
    energy=clamp(energy+(net>=0?net*.95:net/.9),0,r.battery_wh);
    const target=-145+210*clamp(fraction*Math.max(0,Math.sin(Math.max(0,g.sun_el)*rad))*5,0,1);
    temp+=(target-temp)*(1-Math.exp(-1/12));
  }
  const earth=windows(rows,'earth_visible'),sun=windows(rows,'sun_visible');
  const sum=rows.slice(0,-1).reduce((n,g,i)=>n+(g.power_w+rows[i+1].power_w)/2,0);
  const minSoc=Math.min(...rows.map(x=>x.soc)),reserveOk=minSoc>=r.reserve_percent,commsOk=earth.maxGap<=24;
  return {site:{latitude:r.latitude,longitude:r.longitude},landing_time:r.landing_time,duration_days:r.duration_days,
    quality:{ephemeris:'OFFLINE ILLUSTRATIVE GEOMETRY',terrain:'FLAT HORIZON ASSUMPTION — NOT LOLA-VALIDATED',
      temperature:'UNVALIDATED SURFACE-RESPONSE PROXY — NOT SPACECRAFT TEMPERATURE',seismic:'NO SITE-SPECIFIC SEISMIC ASSESSMENT',rover:'NO ROVER TRAVERSABILITY DETERMINED'},
    metrics:{total_energy_wh:Math.round(sum),sun_hours:sun.hours,earth_hours:earth.hours,earth_fraction:round(earth.hours/N,3),
      max_earth_blackout_h:earth.maxGap,max_darkness_h:sun.maxGap,min_soc:round(minSoc,1),
      battery_reserve_pass:reserveOk,communication_pass:commsOk,feasible:reserveOk&&commsOk,first_reserve_violation:firstViolation},
    earth_windows:earth.intervals,sun_windows:sun.intervals,samples:rows};
}
const grid=[[-89.5,0],[-89.5,45],[-89.5,90],[-89.5,135],[-89.5,-90],[-89.1,15],[-89.1,75],[-89.1,145],[-88.5,-35],[-88.5,55],[-88.5,135]];
function rank(out,r){
  const m=out.metrics,possible=1361*r.area_m2*.24*.8*r.duration_days*24;
  return [Number(m.feasible),round(.6*Math.min(1,m.total_energy_wh/Math.max(1,possible))+.4*m.earth_fraction,6),m.min_soc];
}
export function optimize(payload){
  const r=validated(payload.mission),original=simulate(r),choices=[];
  if(payload.preserve==='time'){
    grid.forEach(([latitude,longitude],i)=>{if(latitude!==r.latitude||longitude!==r.longitude)choices.push({name:'Grid '+(i+1),request:{...r,latitude,longitude}})});
  }else if(payload.preserve==='site'){
    for(let j=-28;j<=28;j++)if(j!==0)choices.push({name:(j>=0?'+':'')+(j*12)+' h',request:{...r,landing_time:iso(Date.parse(r.landing_time)+j*12*HOUR)}});
  }else throw Error('preserve must be site or time');
  const sorted=choices.map(c=>({...c,result:simulate(c.request)})).sort((a,b)=>{
    const x=rank(a.result,r),y=rank(b.result,r);return y[0]-x[0]||y[1]-x[1]||y[2]-x[2];
  });
  const winner=sorted[0],feasible=sorted.some(c=>c.result.metrics.feasible);
  return {original,recommended:winner?.result??null,recommendation_name:winner?.name??null,
    alternatives:sorted.slice(0,5).map(c=>({name:c.name,site:c.result.site,landing_time:c.result.landing_time,metrics:c.result.metrics})),
    preserve:payload.preserve,
    search:payload.preserve==='time'?'Demonstration grid of 11 south-pole coordinates; not vetted landing zones.':'Fixed site; landing dates sampled every 12 hours within ±14 days.',
    comparison_note:feasible?'Top feasible alternatives rank by modeled energy and Earth visibility.':'No evaluated alternative passes both illustrative battery reserve and 24-hour-blackout checks. The displayed candidate is NOT certified safe.',
    scientific_limit:'Browser-only demonstration; NASA terrain and actual landing safety are not evaluated.'};
}
export async function staticApi(path,body){
  await Promise.resolve();
  if(path==='preview')return preview(body);
  if(path==='simulate')return simulate(body);
  if(path==='optimize')return optimize(body);
  throw Error('Unsupported static endpoint: '+path);
}
