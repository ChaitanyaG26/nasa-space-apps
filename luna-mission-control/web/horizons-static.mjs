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
const DATA_URL=new URL("./assets/horizons-moon-reference.json",import.meta.url).href;
let cached=null;
const norm=(v)=>{const m=Math.hypot(v.x,v.y,v.z);if(!(m>0))throw Error("Invalid ephemeris vector");return {x:v.x/m,y:v.y/m,z:v.z/m};};
const vec=(row,start)=>({x:row[start],y:row[start+1],z:row[start+2]});
const lerp=(a,b,t)=>norm({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

export function verifyReferenceDataset(data){
  if(data?.schema_version!==1||!Array.isArray(data.samples)||data.samples.length<2)throw Error("Invalid JPL Horizons reference dataset");
  if(!data.reference||data.reference.latitude_deg!==0||data.reference.longitude_deg_east!==0)throw Error("Unexpected Horizons reference site");
  const rows=data.samples,step=data.step_hours*3600000;
  if(!(step>=3600000&&step<=24*3600000))throw Error("Invalid ephemeris sample step");
  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    if(!Array.isArray(row)||row.length!==7||!row.every(Number.isFinite))throw Error("Invalid Horizons reference sample");
    if(i>0&&row[0]-rows[i-1][0]!==step)throw Error("Horizons reference coverage gap");
    for(const start of [1,4])if(Math.abs(Math.hypot(row[start],row[start+1],row[start+2])-1)>0.001)throw Error("Invalid reference direction");
  }
  return data;
}

export async function loadJplReference(){
  if(cached)return cached;
  // Failure is deliberately NOT replaced by illustrative geometry.
  const response=await fetch(DATA_URL,{cache:"default"});
  if(!response.ok)throw Error("NASA JPL Horizons dataset has not been published yet (HTTP "+response.status+"). Check the Horizons cache GitHub Action, or explicitly switch to Offline illustrative geometry.");
  const data=verifyReferenceDataset(await response.json());
  cached=data;
  return data;
}

export function atUtc(data,when){
  const millis=Date.parse(when);
  if(!Number.isFinite(millis))throw Error("Invalid date/time for Horizons data");
  const rows=data.samples,first=rows[0][0],last=rows.at(-1)[0];
  if(millis<first||millis>last){
    throw Error("JPL Horizons cache covers "+data.start_utc.slice(0,10)+" through "+data.end_utc.slice(0,10)+" UTC. Change the landing date or explicitly select Offline illustrative geometry.");
  }
  const pos=clamp(Math.floor((millis-first)/(data.step_hours*3600000)),0,rows.length-2);
  const left=rows[pos],right=rows[pos+1];
  const alpha=clamp((millis-left[0])/(right[0]-left[0]),0,1);
  return {sun:lerp(vec(left,1),vec(right,1),alpha),earth:lerp(vec(left,4),vec(right,4),alpha)};
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

export function geometryAtUtc(data,lat,lon,when){
  const global=atUtc(data,when);
  const [sun_az,sun_el]=localAngles(global.sun,lat,lon);
  const [earth_az,earth_el]=localAngles(global.earth,lat,lon);
  return {time:new Date(when).toISOString(),sun_az,sun_el,earth_az,earth_el,global};
}

export function geometrySeries(data,req){
  const start=Date.parse(req.landing_time),steps=req.duration_days*24;
  // Date range checks apply to the entire mission, not just landing instant.
  atUtc(data,new Date(start));
  atUtc(data,new Date(start+steps*3600000));
  return Array.from({length:steps+1},(_,i)=>geometryAtUtc(data,req.latitude,req.longitude,start+i*3600000));
}

export function referencePreview(data,req){
  const g=geometryAtUtc(data,req.latitude,req.longitude,req.landing_time);
  return {
    source:"NASA JPL Horizons — cached Moon-reference ephemeris, site-projected (approximate)",
    global_source:"JPL Horizons, 0°N 0°E lunar reference, interpolated (not a site-specific Horizons query)",
    global:g.global,
    coverage:data.start_utc.slice(0,10)+" through "+data.end_utc.slice(0,10)+" UTC",
    sun_az:Number(g.sun_az.toFixed(2)),sun_el:Number(g.sun_el.toFixed(2)),
    earth_az:Number(g.earth_az.toFixed(2)),earth_el:Number(g.earth_el.toFixed(2))
  };
}
