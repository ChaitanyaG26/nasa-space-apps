import test from "node:test";
import assert from "node:assert/strict";
import {buildTerrainMesh,localSampleKm,seismicEvidence,slopeClass} from "../web/terrain-3d.mjs";
import {unpackPolarPatch} from "../web/lola-polar-detail.mjs";
test("Seismic evidence cannot label selected site as safely inactive",()=>{
 for(const [lat,lon] of [[-89.5,0],[-53.033,-99.811],[0,0],[60,120]]){
  const e=seismicEvidence(lat,lon);
  assert.equal(e.hasSiteRiskEstimate,false);
  assert.match(e.classification,/UNASSESSED/);
  assert.ok(e.mapColor);
 }
});
test("NASA polar seismic research caution is communicated without invented hazard score",()=>{
 const p=seismicEvidence(-88.5,45);
 assert.match(p.researchConcern,/south-polar/);
 assert.ok(!("riskScore" in p));
});
test("Slope classification uses real terrain only, not a seismic score",()=>{
 assert.equal(slopeClass(4),"green");
 assert.equal(slopeClass(12),"amber");
 assert.equal(slopeClass(19),"red");
 assert.equal(slopeClass(null),"missing");
});
test("3D patch mesh is georeferenced and conserves height unit km",()=>{
 const raw=new Int16Array(512*512).fill(1200);
 const patch=unpackPolarPatch(raw.buffer,{id:"test",latitude:-89.5,longitude:0},
 {schema_version:1,cell_size_m:20,width:512,height:512});
 const m=buildTerrainMesh({latitude:-89.5,longitude:0,patch,size:21});
 assert.equal(m.detail,true);
 assert.equal(m.spacingKm,.02);
 assert.ok(Math.abs(m.range.min-1.2)<1e-6);
 assert.ok(Math.abs(m.range.max-1.2)<1e-6);
 assert.equal(m.distribution.red,0);
 assert.equal(m.vertices.length,21);
});
test("Missing terrain remains missing, not made green/safe",()=>{
 const m=buildTerrainMesh({latitude:-89.5,longitude:0,size:21});
 assert.equal(m.range.min,null);
 assert.equal(m.distribution.green,0);
 assert.equal(m.distribution.missing,20*20);
 assert.equal(localSampleKm(null,0,0),null);
});
