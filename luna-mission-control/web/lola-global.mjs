/** NASA LOLA global elevation (8 ppd; ~3.8 km N-S): regional terrain only.
 * Source: https://svs.gsfc.nasa.gov/4720/
 * Heights: half-meters relative to 1737.4 km lunar sphere.
 */
const W=2880,H=1440,DEG=Math.PI/180,R=1737.4;
let dataset=null;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function decodeLolaBuffer(buffer,meta={width:W,height:H,pixels_per_degree:8}){
  if(meta.width!==W||meta.height!==H||meta.pixels_per_degree!==8||buffer.byteLength!==W*H*2)
    throw Error("NASA LOLA global grid shape mismatch");
  return {view:new DataView(buffer),meta,cache:new Map()};
}
export async function loadLolaGlobal(){
  if(dataset)return dataset;
  const url=new URL("./assets/lola-global-8ppd.bin",import.meta.url);
  const metaUrl=new URL("./assets/lola-global-8ppd.json",import.meta.url);
  const [bin,m]=await Promise.all([fetch(url),fetch(metaUrl)]);
  if(!bin.ok||!m.ok)throw Error("NASA LOLA global elevation not yet published; check the global LOLA GitHub Action");
  dataset=decodeLolaBuffer(await bin.arrayBuffer(),await m.json());
  return dataset;
}
function cell(data,x,y){
  const i=((y*W+((x%W+W)%W))*2);
  const raw=data.view.getInt16(i,true);
  return raw===-32768?null:raw/2000; // km above reference lunar sphere
}
export function elevationGlobalKm(data,latitude,longitude){
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude < -90||latitude>90)return null;
  const x=((longitude+180)%360+360)%360*8-.5;
  const y=clamp((90-latitude)*8-.5,0,H-1);
  const x0=Math.floor(x),y0=Math.floor(y),y1=Math.min(H-1,y0+1);
  const tx=x-x0,ty=y-y0;
  const p=[cell(data,x0,y0),cell(data,x0+1,y0),cell(data,x0,y1),cell(data,x0+1,y1)];
  if(p.some(v=>v===null))return null;
  return (1-tx)*((1-ty)*p[0]+ty*p[2])+tx*((1-ty)*p[1]+ty*p[3]);
}
export function siteElevation(data,lat,lon){
  const elevation=elevationGlobalKm(data,lat,lon);
  return {
    latitude:lat,longitude:lon,
    elevation_km:elevation===null?null:Number(elevation.toFixed(3)),
    coverage:elevation!==null,
    source:"NASA LOLA global elevation, 8 pixels/degree (2×2 aggregated)",
    resolution:"~3.8 km N-S cells; regional terrain only",
    datum:"1737.4-km lunar reference sphere",
    limitations:"Cannot resolve local boulders, meter-scale slopes, or nearby crater rims."
  };
}
// Great-circle destination using east-positive longitude and azimuth clockwise
// from north. All distances are along the 1737.4-km sphere.
export function destination(lat,lon,bearingDeg,distanceKm){
  const phi=lat*DEG,lam=lon*DEG,b=bearingDeg*DEG,d=distanceKm/R;
  const phi2=Math.asin(clamp(Math.sin(phi)*Math.cos(d)+Math.cos(phi)*Math.sin(d)*Math.cos(b),-1,1));
  const lam2=lam+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(phi),Math.cos(d)-Math.sin(phi)*Math.sin(phi2));
  return [phi2/DEG,((lam2/DEG+540)%360)-180];
}
// Approximate maximum obstruction angle from measured terrain grid, relative
// to a local radial-up horizontal. No refraction on the airless Moon.
// A horizon at 0° is the conservative nominal tangent where local fine DEM
// is unavailable. This grid does NOT resolve near-field terrain.
export function terrainHorizon(data,lat,lon,{bearings=72,maxRangeKm=120}={}){
  if(!Number.isFinite(lat)||!Number.isFinite(lon))throw Error("Invalid terrain coordinates");
  const key=lat.toFixed(3)+","+lon.toFixed(3)+":"+bearings+":"+maxRangeKm;
  if(data.cache.has(key))return data.cache.get(key);
  const observer=elevationGlobalKm(data,lat,lon);
  if(observer===null)return {coverage:false,horizon:null,reason:"NASA LOLA elevation missing"};
  const angles=new Array(bearings).fill(0);
  let missing=0,total=0;
  for(let k=0;k<bearings;k++){
    const az=k*360/bearings;
    // Adaptive sampling, starting at 2 km; near-field below the pixel
    // spacing is unresolved, and the result must not be treated as exact.
    for(let dist=2;dist<=maxRangeKm;dist+=dist<20?2:dist<60?4:8){
      total++;
      const [a,b]=destination(lat,lon,az,dist);
      const top=elevationGlobalKm(data,a,b);
      if(top===null){missing++;continue;}
      const theta=dist/R;
      const numerator=(R+top)*Math.cos(theta)-(R+observer);
      const denominator=(R+top)*Math.sin(theta);
      const elevation=Math.atan2(numerator,denominator)/DEG;
      if(elevation>angles[k])angles[k]=elevation;
    }
  }
  const result={coverage:missing/total<.1,horizon:angles,site_elevation_km:observer,
    bearing_step_deg:360/bearings,max_range_km:maxRangeKm,
    near_field_resolved:false,source:"NASA LOLA 8 ppd global GDR, coarse terrain ray tracing",
    limitations:"Angular bins and kilometer pixels cannot certify local line-of-sight, landability, or rover paths."};
  if(data.cache.size>96)data.cache.clear();
  data.cache.set(key,result);
  return result;
}
export function horizonAngle(horizon,az){
  if(!horizon?.coverage)return null;
  const arr=horizon.horizon,x=((az%360+360)%360)*arr.length/360,i=Math.floor(x),f=x-i;
  return arr[i%arr.length]*(1-f)+arr[(i+1)%arr.length]*f;
}
