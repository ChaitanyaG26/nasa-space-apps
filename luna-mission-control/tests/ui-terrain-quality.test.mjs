import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decodeFloatTiff,localBbox,gridFromUs3depImage} from "../web/usgs-3dep.mjs";
import {drawMissionSurface3D} from "../web/mission-surface-3d.mjs";

function smallTiff(){
 const tags=[[256,4,4],[257,4,4],[258,3,32],[259,3,1],
  [273,4,128],[277,3,1],[278,4,4],[279,4,64],[339,3,3]];
 const b=new ArrayBuffer(192),v=new DataView(b);
 v.setUint8(0,73);v.setUint8(1,73);v.setUint16(2,42,true);v.setUint32(4,8,true);
 v.setUint16(8,tags.length,true);
 for(let i=0;i<tags.length;i++){
  const [id,type,value]=tags[i],p=10+i*12;
  v.setUint16(p,id,true);v.setUint16(p+2,type,true);
  v.setUint32(p+4,1,true);
  if(type===3)v.setUint16(p+8,value,true);
  else v.setUint32(p+8,value,true);
 }
 for(let i=0;i<16;i++)v.setFloat32(128+i*4,16+i,true);
 return b;
}
test("USGS image decoder reads bounded F32 uncompressed TIFF with true elevation sample values",()=>{
 const decoded=decodeFloatTiff(smallTiff());
 assert.equal(decoded.width,4);assert.equal(decoded.height,4);
 assert.equal(decoded.data[0],16);assert.equal(decoded.data[15],31);
 const grid=gridFromUs3depImage(decoded,{siteId:"ksc",footprintM:600});
 assert.equal(grid.coverage,1);assert.equal(grid.center,26);
 assert.equal(grid.sourceResolutionKnown,false);
 assert.equal(grid.rows[0][0].n,300);
 assert.equal(grid.rows[3][0].n,-300);
});
test("USGS location footprint is geodetic and rejects implausible values",()=>{
 const a=localBbox(28.627,-80.621,600);
 assert.ok(a[0]<-80.621&&a[2]>-80.621);
 assert.ok(a[1]<28.627&&a[3]>28.627);
 assert.throws(()=>localBbox(28.627,-80.621,5000));
});
test("Earth launch terrain prefers 3DEP and degrades to Mapzen rather than declaring fake higher resolution",()=>{
 const source=readFileSync(new URL("../web/mission-surface-3d.mjs",import.meta.url),"utf8");
 assert.ok(source.indexOf("await loadUSGS3DEPGrid(")<source.indexOf("for(const z of [15,14,13])"));
 assert.match(source,/sourceResolutionKnown:false/);
 assert.match(source,/grid\?\.detail===false\?4\.5/);
 assert.match(source,/launchSupportFrame/);
 assert.match(source,/projectedRing/);
});
test("3D nightside remains visible while avoiding false solar illumination",()=>{
 const terrain=readFileSync(new URL("../web/mission-surface-3d.mjs",import.meta.url),"utf8");
 assert.match(terrain,/night\?\.68/);
 assert.match(terrain,/night\?\.71/);
 assert.match(terrain,/terrainExaggeration/);
 const chart=readFileSync(new URL("../web/styles.css",import.meta.url),"utf8");
 assert.match(chart,/details\.chart-information\[open\]/);
 assert.match(chart,/background:transparent!important/);
 assert.match(chart,/body:has\(\.science-plot\.chart-expanded\)/);
 assert.match(chart,/height:auto!important;aspect-ratio:320\/134/);
 assert.match(chart,/height:auto!important;aspect-ratio:320\/110/);
});
test("Animation descriptions remain linked to their own scene and not a dark pill",()=>{
 const scene=readFileSync(new URL("../web/mission-sequences.mjs",import.meta.url),"utf8");
 const explorer=readFileSync(new URL("../web/terrain-3d.mjs",import.meta.url),"utf8");
 assert.match(scene,/sequenceInfo\("launch"\)/);
 assert.match(scene,/sequenceInfo\("landing"\)/);
 assert.match(scene,/pointerenter/);
 assert.match(scene,/Local terrain/gi);
 assert.match(explorer,/exag=patch\?6:10/);
 assert.match(explorer,/footprintKm=patch\?\.5:50/);
 assert.match(explorer,/terrain-info/);
});
