import test from "node:test";
import assert from "node:assert/strict";
import {unpackPolarPatch} from "../web/lola-polar-detail.mjs";
import {roverRouteScreen} from "../web/rover-screen.mjs";
const N=512;
function terrain(fn=(x,y)=>0){
 const bytes=new ArrayBuffer(N*N*2),view=new DataView(bytes);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++)view.setInt16((y*N+x)*2,fn(x,y),true);
 return unpackPolarPatch(bytes,{id:"test",latitude:-89.5,longitude:0},
 {schema_version:1,cell_size_m:20,width:N,height:N});
}
test("Missing NASA 20m terrain does not fabricate traversable route",()=>{
 const r=roverRouteScreen(null,-89.5,0);
 assert.equal(r.available,false);
});
test("Flat terrain yields straight A-star screened route",()=>{
 const r=roverRouteScreen(terrain(),-89.5,0,{eastM:200,northM:0,maxSlopeDeg:15});
 assert.equal(r.found,true);
 assert.ok(Math.abs(r.length_m-200)<=20);
 assert.equal(r.maximum_segment_slope_deg,0);
 assert.equal(r.elevation_gain_m,0);
 assert.match(r.status,/NOT A SAFE/);
});
test("Slope cliff corridor does not return unsafe route",()=>{
 const r=roverRouteScreen(terrain((x)=>x>=260?20000:0),-89.5,0,
  {eastM:300,northM:0,maxSlopeDeg:10,maxSearchMeters:200});
 assert.equal(r.found,false);
});
test("Terrain route respects missing data barriers and reported no-route",()=>{
 const r=roverRouteScreen(terrain(x=>x>=260&&x<=270?-32768:0),-89.5,0,
  {eastM:400,northM:0,maxSlopeDeg:15,maxSearchMeters:200});
 assert.equal(r.found,false);
});
test("Rejects invalid rover assumption",()=>{
 assert.throws(()=>roverRouteScreen(terrain(),-89.5,0,{eastM:5000}),/Invalid rover/);
});
