/** NASA LOLA 20-meter polar detail on four selected 10.24-km patches.
 * Registered local Moon azimuthal-equidistant coordinates, 1737400-m sphere.
 * A small high-resolution patch supplements, not replaces, global LOLA.
 */
import {destination} from "./lola-global.mjs";
const R=1737400, DEG=Math.PI/180;
let manifest=null;
const cached=new Map();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const geoVector=(lat,lon)=>{
 const p=lat*DEG,l=lon*DEG;
 return [Math.cos(p)*Math.sin(l),Math.sin(p),Math.cos(p)*Math.cos(l)];
};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function localPatchXY(originLat,originLon,lat,lon){
 const c=geoVector(originLat,originLon),v=geoVector(lat,lon),p=originLat*DEG,l=originLon*DEG;
 const e=[Math.cos(l),0,-Math.sin(l)];
 const n=[-Math.sin(p)*Math.sin(l),Math.cos(p),-Math.sin(p)*Math.cos(l)];
 const angle=Math.acos(clamp(dot(c,v),-1,1));
 const tangent=Math.hypot(dot(v,e),dot(v,n));
 if(angle<1e-11)return [0,0];
 if(tangent<1e-12)return [0,0];
 return [R*angle*dot(v,e)/tangent,R*angle*dot(v,n)/tangent];
}
export function unpackPolarPatch(buffer,entry,meta){
 if(meta?.schema_version!==1||meta.cell_size_m!==20||meta.width!==512||meta.height!==512||buffer.byteLength!==512*512*2)
   throw Error("NASA LOLA polar detailed terrain has invalid dimensions");
 return {view:new DataView(buffer),entry,meta};
}
export async function loadPolarPatch(lat,lon){
 if(!manifest){
  try{
   const response=await fetch(new URL("./assets/lola-polar-detail.json?v=1",import.meta.url));
   if(!response.ok)return null;
   manifest=await response.json();
   if(manifest.schema_version!==1)throw Error("Invalid NASA 20m patch schema");
  }catch(error){console.warn("NASA detailed polar elevation is unavailable",error);return null;}
 }
 const pick=manifest.patches.find(x=>{
   const [east,north]=localPatchXY(x.latitude,x.longitude,lat,lon);
   return Math.abs(east)<4900&&Math.abs(north)<4900;
 });
 if(!pick)return null;
 if(cached.has(pick.id))return cached.get(pick.id);
 const response=await fetch(new URL("./assets/"+pick.binary,import.meta.url));
 if(!response.ok)return null;
 const data=unpackPolarPatch(await response.arrayBuffer(),pick,manifest);
 cached.set(pick.id,data);
 return data;
}
export function samplePolarHeightKm(patch,lat,lon){
 if(!patch)return null;
 const [east,north]=localPatchXY(patch.entry.latitude,patch.entry.longitude,lat,lon);
 const x=(east+5120)/20-.5,y=(5120-north)/20-.5;
 const x0=Math.floor(x),y0=Math.floor(y);
 if(x0<0||x0>=511||y0<0||y0>=511)return null;
 const fx=x-x0,fy=y-y0;
 const val=(xx,yy)=>patch.view.getInt16((yy*512+xx)*2,true);
 const v=[val(x0,y0),val(x0+1,y0),val(x0,y0+1),val(x0+1,y0+1)];
 if(v.includes(-32768))return null;
 return ((1-fx)*(1-fy)*v[0]+fx*(1-fy)*v[1]+(1-fx)*fy*v[2]+fx*fy*v[3])/1000;
}
export function polarSiteSlopeDeg(patch,lat,lon){
 const [nLat,nLon]=destination(lat,lon,0,.04);
 const [sLat,sLon]=destination(lat,lon,180,.04);
 const [eLat,eLon]=destination(lat,lon,90,.04);
 const [wLat,wLon]=destination(lat,lon,270,.04);
 const z=[samplePolarHeightKm(patch,nLat,nLon),samplePolarHeightKm(patch,sLat,sLon),
          samplePolarHeightKm(patch,eLat,eLon),samplePolarHeightKm(patch,wLat,wLon)];
 if(z.some(v=>v===null))return null;
 const slope=Math.hypot((z[2]-z[3])*1000/80,(z[0]-z[1])*1000/80);
 return Math.atan(slope)*180/Math.PI;
}
export function refinePolarHorizon(patch,lat,lon,coarse){
 if(!patch)return coarse;
 const observer=samplePolarHeightKm(patch,lat,lon);
 if(observer===null)return coarse;
 const n=coarse?.horizon?.length||72;
 const angles=coarse?.horizon?.slice()||new Array(n).fill(0);
 let valid=0,attempts=0;
 for(let i=0;i<n;i++){
  const az=i*360/n;
  for(let meters=40;meters<=3000;meters+=meters<400?40:meters<1200?80:160){
   const [a,b]=destination(lat,lon,az,meters/1000);
   const h=samplePolarHeightKm(patch,a,b);
   attempts++;
   if(h===null)continue;
   valid++;
   const theta=meters/R;
   const numerator=(R+1000*h)*Math.cos(theta)-(R+1000*observer);
   const denominator=(R+1000*h)*Math.sin(theta);
   const angle=Math.atan2(numerator,denominator)/DEG;
   if(angle>angles[i])angles[i]=angle;
  }
 }
 if(valid/Math.max(1,attempts)<.75)return coarse;
 return {coverage:true,horizon:angles,bearing_step_deg:360/n,
    max_range_km:coarse?.max_range_km??3,
    detail_resolution_m:20,near_field_resolved:true,source:"NASA LOLA 20m polar local patches + coarse global terrain",
    limitations:"20m elevation interpolation does not resolve meter-sized boulders; sampled near field to 3 km, coarse terrain farther away."};
}
