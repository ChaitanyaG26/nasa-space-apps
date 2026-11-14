import test from "node:test";
import assert from "node:assert/strict";
import {localPatchXY,unpackPolarPatch,samplePolarHeightKm,polarSiteSlopeDeg,refinePolarHorizon} from "../web/lola-polar-detail.mjs";
const SIZE=512;
function patch(){
 const arr=new Int16Array(SIZE*SIZE).fill(1000);
 return unpackPolarPatch(arr.buffer,{id:"test",latitude:-89.5,longitude:0},
  {schema_version:1,cell_size_m:20,width:512,height:512});
}
test("Polar local coordinate is registered at its center and reflects direction",()=>{
 const xy=localPatchXY(-89.5,0,-89.5,0);
 assert.ok(xy.every(v=>Math.abs(v)<1e-4));
 const east=localPatchXY(-89.5,0,-89.5,.1);
 assert.ok(east[0]>0);
});
test("NASA polar detail values decode meters to km",()=>{
 const data=patch();
 assert.ok(Math.abs(samplePolarHeightKm(data,-89.5,0)-1)<1e-8);
 assert.ok(polarSiteSlopeDeg(data,-89.5,0)<1e-8);
});
test("Nearby obstacle contributes local horizon without replacing far terrain",()=>{
 const data=patch();
 const center=SIZE/2;
 // synthetic ridge 200m east of center, 1.5km taller
 for(let y=center-20;y<center+20;y++)for(let x=center+8;x<center+20;x++)
  data.view.setInt16((y*SIZE+x)*2,2500,true);
 const coarse={coverage:true,horizon:new Array(72).fill(0),bearing_step_deg:5,max_range_km:120};
 const out=refinePolarHorizon(data,-89.5,0,coarse);
 assert.ok(out.horizon[18]>0);
 assert.equal(out.horizon[54],0);
 assert.equal(out.detail_resolution_m,20);
});
