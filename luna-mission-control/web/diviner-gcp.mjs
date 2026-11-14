/** Actual NASA Diviner GCP historic TBOL observations, NOT temperature forecasts.
 * PDS3 binning 0.5° x 0.5° and 0.25h solar local time, 2009-2015.
 * Use local solar time computed from JPL Horizons Sun direction at UTC;
 * never confuse 2026 geometry with the 2009-2015 observation epoch.
 */
const W=720,H=20,SLOTS=96,NO_DATA=-32768,DATA_VERSION="gcp1";
let metadata=null;
const datasets=new Map();
const wrap=x=>((x%360)+360)%360;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function decodeDiviner(buffer,band,meta){
 if(meta?.schema_version!==1||meta.width!==W||meta.height_per_band!==H||
    meta.local_time_bins!==SLOTS||buffer.byteLength!==W*H*SLOTS*2)
   throw Error("Invalid NASA Diviner GCP table shape");
 return {view:new DataView(buffer),band,meta};
}
export function readMeasuredBin(data,latitude,longitude,localTimeHours){
 if(![latitude,longitude,localTimeHours].every(Number.isFinite))return null;
 const x=Math.round((wrap(longitude+180)-.25)*2);
 const y=Math.round((data.band.latitude_north_edge-.25-latitude)*2);
 const slot=Math.round((wrap(localTimeHours*15)/15-.125)*4);
 if(x<0||x>=W||y<0||y>=H||slot<0||slot>=SLOTS)return null;
 const index=((y*W+x)*SLOTS+slot)*2;
 const n=data.view.getInt16(index,true);
 return n===NO_DATA?null:n/10;
}
export function localSolarTimeHours(longitude,globalSun){
 // The Sun is overhead on the subsolar meridian at 12:00 local lunar time.
 const subsolarLon=Math.atan2(globalSun.x,globalSun.z)*180/Math.PI;
 return wrap(longitude-subsolarLon)/15 + 12 >=24 ? wrap(longitude-subsolarLon)/15-12 : wrap(longitude-subsolarLon)/15+12;
}
export function divinerObservedReference(dataset,lat,lon,globalSun){
 if(!dataset||!globalSun)return null;
 const localTime=localSolarTimeHours(lon,globalSun);
 const k=readMeasuredBin(dataset,lat,lon,localTime);
 if(k===null)return null;
 return {
   temperature_c:Number((k-273.15).toFixed(2)),
   measured_binned_k:k,
   observed_local_time_h:Number(localTime.toFixed(2)),
   source:"NASA LRO Diviner GCP 2009-2015 historical climatology (measured local-time bin)",
   status:"MEASURED HISTORICAL REFERENCE — NOT OBSERVED ON SELECTED MISSION DATE",
   spatial_bin_deg:.5,temporal_bin_h:.25
 };
}
export async function loadDiviner(){
 if(!metadata){
   const url=new URL("./assets/diviner-gcp-meta.json?v="+DATA_VERSION,import.meta.url);
   const response=await fetch(url);
   if(!response.ok)throw Error("NASA Diviner archival temperature cache is not yet available");
   metadata=await response.json();
   if(metadata.schema_version!==1||metadata.width!==W||metadata.local_time_bins!==SLOTS)
     throw Error("Invalid NASA Diviner metadata schema");
 }
 return metadata;
}
export async function loadDivinerAtLatitude(latitude){
 const meta=await loadDiviner();
 const band=meta.bands.find(b=>latitude<=b.latitude_north_edge&&latitude>=b.latitude_north_edge-10);
 if(!band)return null;
 if(datasets.has(band.name))return datasets.get(band.name);
 const url=new URL("./assets/"+band.file+"?v="+DATA_VERSION,import.meta.url);
 const response=await fetch(url);
 if(!response.ok)throw Error("NASA Diviner bin data missing for latitude band "+band.name);
 const data=decodeDiviner(await response.arrayBuffer(),band,meta);
 datasets.set(band.name,data);
 return data;
}
