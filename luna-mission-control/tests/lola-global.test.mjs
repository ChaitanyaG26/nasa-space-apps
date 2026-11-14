import test from "node:test";
import assert from "node:assert/strict";
import {decodeLolaBuffer,elevationGlobalKm,siteElevation,destination,terrainHorizon,horizonAngle} from "../web/lola-global.mjs";
const W=2880,H=1440;
function fixture(height=0){
 const arr=new Int16Array(W*H).fill(Math.round(height*2000));
 return decodeLolaBuffer(arr.buffer);
}
test("LOLA global elevation decodes correct half-meter units",()=>{
 const d=fixture(1.5);
 assert.equal(elevationGlobalKm(d,-53.033,-99.811),1.5);
 assert.equal(siteElevation(d,32,32).elevation_km,1.5);
});
test("LOLA global interpolation wraps at 180 longitude",()=>{
 const d=fixture(0);
 assert.equal(elevationGlobalKm(d,0,180),elevationGlobalKm(d,0,-180));
 assert.equal(elevationGlobalKm(d,90,0),0);
});
test("Ray tracing on flat lunar sphere leaves tangent unobstructed",()=>{
 const d=fixture(0);
 const h=terrainHorizon(d,-53.033,-99.811,{bearings:36,maxRangeKm:80});
 assert.equal(h.coverage,true);
 assert.ok(h.horizon.every(x=>x===0));
 assert.equal(horizonAngle(h,25),0);
});
test("LOLA crater rim on east side produces positive obstruction",()=>{
 const d=fixture(0);
 const [lat,lon]=destination(-53.0,-99.8,90,12);
 const x=Math.floor((((lon+180)%360+360)%360)*8);
 const y=Math.floor((90-lat)*8);
 // Synthetic ridge spans ~3.8 km, 3 km above reference sphere.
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const i=(Math.max(0,Math.min(H-1,y+dy))*W+(x+dx+W)%W);
  d.view.setInt16(i*2,6000,true);
 }
 const h=terrainHorizon(d,-53,-99.8,{bearings:72,maxRangeKm:40});
 assert.ok(horizonAngle(h,90)>0);
 assert.equal(horizonAngle(h,270),0);
});
test("NoData return null, no fabricated values",()=>{
 const d=fixture(0);
 d.view.setInt16(0,-32768,true);
 assert.throws(()=>decodeLolaBuffer(new ArrayBuffer(8)),/shape mismatch/);
});
