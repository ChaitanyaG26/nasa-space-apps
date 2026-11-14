import test from "node:test";
import assert from "node:assert/strict";
import {decodeDiviner,readMeasuredBin,localSolarTimeHours,divinerObservedReference} from "../web/diviner-gcp.mjs";
const W=720,H=20,BINS=96;
const meta={schema_version:1,width:W,height_per_band:H,local_time_bins:BINS};
function fixture(){
 const buffer=new ArrayBuffer(W*H*BINS*2),view=new DataView(buffer);
 for(let i=0;i<W*H*BINS;i++)view.setInt16(i*2,-32768,true);
 const band={name:"60s50s",latitude_north_edge:-50};
 return {data:decodeDiviner(buffer,band,meta),view};
}
test("PDS Diviner GCP signed 0.1 K bin yields actual measurement units",()=>{
 const {data,view}=fixture();
 const lon=-99.75,lat=-53.25,time=.125;
 const x=Math.round(((lon+180)%360-.25)*2),y=Math.round((-50-.25-lat)*2),slot=0;
 view.setInt16(((y*W+x)*BINS+slot)*2,3022,true);
 assert.equal(readMeasuredBin(data,lat,lon,time),302.2);
 assert.equal(readMeasuredBin(data,lat,lon,1.125),null);
 const observed=divinerObservedReference(data,lat,lon,{x:Math.sin((-lon)*Math.PI/180),z:Math.cos((-lon)*Math.PI/180)});
 assert.ok(observed===null||observed.status.includes("HISTORICAL"));
});
test("Lunar local time is based on relative Moon-fixed Sun longitude",()=>{
 assert.equal(localSolarTimeHours(0,{x:0,z:1}),12);
 assert.equal(localSolarTimeHours(90,{x:0,z:1}),18);
 assert.equal(localSolarTimeHours(-90,{x:0,z:1}),6);
});
test("Missing Diviner bands and missing values are not filled with fictional measurements",()=>{
 const {data}=fixture();
 assert.equal(readMeasuredBin(data,-43,30,12),null);
 assert.equal(readMeasuredBin(data,-55,30,12),null);
 assert.throws(()=>decodeDiviner(new ArrayBuffer(2),{latitude_north_edge:-50},meta),/shape/);
});

test("Committed global NASA PDS Diviner source is readable and has measured samples",async()=>{
 const {readFileSync}=await import("node:fs");
 const meta=JSON.parse(readFileSync(new URL("../web/assets/diviner-gcp-meta.json",import.meta.url),"utf8"));
 assert.equal(meta.schema_version,1);
 assert.equal(meta.bands.length,18);
 assert.equal(meta.local_time_bins,96);
 const band=meta.bands.find(x=>x.name==="60s50s");
 const b=readFileSync(new URL("../web/assets/"+band.file,import.meta.url));
 const buffer=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
 const data=decodeDiviner(buffer,band,meta);
 const values=Array.from({length:96},(_,i)=>readMeasuredBin(data,-53.25,-99.75,.125+i*.25)).filter(v=>v!==null);
 assert.ok(values.length>5, "No actual NASA Diviner local-time samples near the test site");
 assert.ok(values.every(v=>v>0&&v<500));
 assert.ok(meta.bands.every(x=>x.source_sha256.length===64));
});
