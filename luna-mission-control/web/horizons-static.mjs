/** Cache-backed JPL Horizons reference geometry for the GitHub Pages frontend.
 *
 * NASA/JPL SSD API disallows direct website embedding under its CORS policy.
 * The JSON is downloaded by a GitHub Actions server-side job from official
 * Horizons observer tables. Each vector is derived from a FIXED lunar observer
 * at 0° longitude, 0° latitude. Projecting it to an arbitrary site produces
 * approximate azimuth/elevation; it is NOT equivalent to Horizons QUANTITIES=4
 * queried at that exact site, particularly near Earthrise and Earthset.
 */
const DEG=Math.PI/180;
const DATA_URL=new URL("./assets/horizons-moon-reference.json?schema=2&sampling=1h&v=20261114b",import.meta.url).href;
let cached=null;
const norm=(v)=>{const m=Math.hypot(v.x,v.y,v.z);if(!(m>0))throw Error("Invalid ephemeris vector");return {x:v.x/m,y:v.y/m,z:v.z/m};};
const vec=(row,start)=>({x:row[start],y:row[start+1],z:row[start+2]});
const lerp=(a,b,t)=>norm({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

const MOON_RADIUS_KM=1737.4;
// The UI supplies ISO UTC timestamps; the hourly integrator supplies integer
// milliseconds. Date.parse(number) returns NaN, so normalize explicitly.
export function utcMillis(value){
  let result;
  if(typeof value==="number") result=value;
  else if(value instanceof Date) result=value.getTime();
  else if(typeof value==="string" && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) result=Date.parse(value);
  if(!Number.isFinite(result)) throw Error("Invalid UTC date/time for JPL Horizons: supply an ISO-8601 UTC timestamp or Unix milliseconds.");
  return result;
}
export function verifyReferenceDataset(data){
  if(data?.schema_version!==2||!Array.isArray(data.samples)||data.samples.length<2)
    throw Error("NASA Horizons center-position dataset v2 is missing. Check the NASA cache job before using JPL mode.");
  if(!data.reference||data.reference.latitude_deg!==0||data.reference.longitude_deg_east!==0)
    throw Error("Unexpected Horizons reference site");
  const rows=data.samples,step=data.step_hours*3600000;
  if(!(step>=3600000&&step<=24*3600000))throw Error("Invalid ephemeris sample step");
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    if(!Array.isArray(row)||row.length!==7||!row.every(Number.isFinite))throw Error("Invalid Horizons position record");
    if(i>0&&row[0]-rows[i-1][0]!==step)throw Error("Horizons reference coverage gap");
    if(! (1.3e8<Math.hypot(...row.slice(1,4))&&Math.hypot(...row.slice(1,4))<1.7e8 &&
            3e5<Math.hypot(...row.slice(4,7))&&Math.hypot(...row.slice(4,7))<5e5))
      throw Error("Implausible NASA Horizons body distance");
  }
  return data;
}

export async function loadJplReference(){
  if(cached)return cached;
  const response=await fetch(DATA_URL,{cache:"default"});
  if(!response.ok)throw Error("NASA/JPL position dataset is not published yet (HTTP "+response.status+"). No illustrative fallback has been used.");
  cached=verifyReferenceDataset(await response.json());
  return cached;
}

export function centerPositionsAtUtc(data,when){
  const millis=utcMillis(when);
  if(!Number.isFinite(millis))throw Error("Invalid Horizons UTC timestamp");
  const rows=data.samples,first=rows[0][0],last=rows.at(-1)[0];
  if(millis<first||millis>last)throw Error("NASA Horizons cache covers "+data.start_utc.slice(0,10)+" through "+data.end_utc.slice(0,10)+" UTC. Select a supported time.");
  const i=clamp(Math.floor((millis-first)/(data.step_hours*3600000)),0,rows.length-2);
  const a=rows[i],b=rows[i+1],t=clamp((millis-a[0])/(b[0]-a[0]),0,1);
  const xyz=(offset)=>({x:a[offset]+t*(b[offset]-a[offset]),y:a[offset+1]+t*(b[offset+1]-a[offset+1]),z:a[offset+2]+t*(b[offset+2]-a[offset+2])});
  return {sun:xyz(1),earth:xyz(4)};
}
export function surfacePosition(lat,lon,heightKm=0){
  const p=lat*DEG,l=lon*DEG,r=MOON_RADIUS_KM+heightKm;
  return {x:r*Math.cos(p)*Math.sin(l),y:r*Math.sin(p),z:r*Math.cos(p)*Math.cos(l)};
}
export function vectorsForSite(positions,lat,lon,heightKm=0){
  const observer=surfacePosition(lat,lon,heightKm);
  const offset=(body)=>norm({x:body.x-observer.x,y:body.y-observer.y,z:body.z-observer.z});
  return {sun:offset(positions.sun),earth:offset(positions.earth)};
}
export function atUtc(data,when){
  const p=centerPositionsAtUtc(data,when);
  return {sun:norm(p.sun),earth:norm(p.earth)};
}

export function localAngles(direction,lat,lon){
  const p=lat*DEG,l=lon*DEG;
  const east={x:Math.cos(l),y:0,z:-Math.sin(l)};
  const north={x:-Math.sin(p)*Math.sin(l),y:Math.cos(p),z:-Math.sin(p)*Math.cos(l)};
  const up={x:Math.cos(p)*Math.sin(l),y:Math.sin(p),z:Math.cos(p)*Math.cos(l)};
  const elevation=Math.asin(clamp(dot(direction,up),-1,1))/DEG;
  const azimuth=(Math.atan2(dot(direction,east),dot(direction,north))/DEG+360)%360;
  return [azimuth,elevation];
}

export function geometryAtUtc(data,lat,lon,when,heightKm=0){
  const centers=centerPositionsAtUtc(data,when);
  const global={sun:norm(centers.sun),earth:norm(centers.earth)};
  const local=vectorsForSite(centers,lat,lon,heightKm);
  const [sun_az,sun_el]=localAngles(local.sun,lat,lon);
  const [earth_az,earth_el]=localAngles(local.earth,lat,lon);
  return {time:new Date(utcMillis(when)).toISOString(),sun_az,sun_el,earth_az,earth_el,global};
}

export function geometrySeries(data,req,heightKm=0){
  const start=utcMillis(req.landing_time),steps=req.duration_days*24;
  // Date range checks apply to the entire mission, not just landing instant.
  atUtc(data,new Date(start));
  atUtc(data,new Date(start+steps*3600000));
  return Array.from({length:steps+1},(_,i)=>geometryAtUtc(data,req.latitude,req.longitude,start+i*3600000,heightKm));
}

export function referencePreview(data,req,heightKm=0){
  const g=geometryAtUtc(data,req.latitude,req.longitude,req.landing_time,heightKm);
  return {
    source:"NASA JPL Horizons — measured az/el + target range, site parallax corrected",
    global_source:"JPL Horizons Sun/Earth Moon-centered positions, "+data.step_hours+"-hour interpolation (site az/el computed by parallax)",
    global:g.global,
    coverage:data.start_utc.slice(0,10)+" through "+data.end_utc.slice(0,10)+" UTC",
    sun_az:Number(g.sun_az.toFixed(2)),sun_el:Number(g.sun_el.toFixed(2)),
    earth_az:Number(g.earth_az.toFixed(2)),earth_el:Number(g.earth_el.toFixed(2))
  };
}
