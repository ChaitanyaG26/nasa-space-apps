import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeCatalog,demoShipPoint,keplerTransferPoint,idealTransferDays} from "../web/orbit-visualization.mjs";

test("Public OMM catalog metadata is filtered, not treated as conjunction screening",()=>{
 const entries=[{OBJECT_NAME:"ISS",NORAD_CAT_ID:25544,EPOCH:"2026-11-14T12:00:00",MEAN_MOTION:15.5},
  {OBJECT_NAME:"unknown",NORAD_CAT_ID:"bad",EPOCH:"invalid"}];
 const items=normalizeCatalog(entries);
 assert.equal(items.length,1);
 assert.equal(items[0].id,"25544");
});
test("Schematic ship path has finite endpoints and intermediate positions",()=>{
 const a=demoShipPoint(0),b=demoShipPoint(1),mid=demoShipPoint(.5);
 assert.deepEqual(a,{x:102,y:151});
 assert.deepEqual(b,{x:544,y:131});
 assert.ok(mid.x>a.x&&mid.x<b.x&&Number.isFinite(mid.y));
});
test("Catalog display never asserts an operational avoidance solution",()=>{
 const source=readFileSync(new URL("../web/orbit-visualization.mjs",import.meta.url),"utf8");
 assert.match(source,/NOT COLA screening/);
 assert.match(source,/NOT real-time propagated coordinates/);
 assert.match(source,/CACHE_MS=2\*60\*60\*1000/);
});
test("Mission parameters stay in a scrollable left sidebar while only two actions remain above the globe",()=>{
 const html=readFileSync(new URL("../web/index.html",import.meta.url),"utf8");
 const root=readFileSync(new URL("../../index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../web/styles.css",import.meta.url),"utf8");
 for(const page of [html,root]){
  assert.match(page,/<body class="sidebar-layout">/);
  assert.match(page,/<div class="fields" id="missionFields"/);
  const aside=page.split("</aside>")[0],toolbar=page.match(/<nav class="mission-toolbar"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(toolbar,"top action bar missing");
  assert.equal((toolbar.match(/<button\b/g)||[]).length,2,"action bar must contain exactly two buttons");
  assert.equal((toolbar.match(/<select\b|<label\b|<input\b/g)||[]).length,0,"no parameters allowed in action bar");
  for(const id of ["date","time","duration","sampleMinutes","mode","preserve",
                   "area","tilt","az","battery","load","reserve","thermalCap","rfTx","roverSlope"]){
   assert.ok(aside.includes('id="'+id+'"'),id+" should be in left sidebar");
   assert.equal((page.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+" unique");
  }
  for(const id of ["simulate","optimize"]){
   assert.ok(toolbar.includes('id="'+id+'"'),id+" should be in top action bar");
   assert.equal((page.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+" unique");
   assert.ok(!aside.includes('id="'+id+'"'),id+" must not be in left sidebar");
  }
  assert.ok(page.indexOf('<nav class="mission-toolbar"')<page.indexOf('id="mapPage"'));
 }
 assert.match(css,/\.sidebar-layout \.sidebar \.fields\{/);
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/\.sidebar-layout \.mission-toolbar button\{/);
});
test("Idealized transfer solves Kepler time-of-flight and slows near apogee",()=>{
 const duration=idealTransferDays(200,384400);
 assert.ok(duration>4.5&&duration<5.5);
 const near=keplerTransferPoint(0.1),middle=keplerTransferPoint(.5),far=keplerTransferPoint(.9);
 assert.ok(near.radiusKm<middle.radiusKm&&middle.radiusKm<far.radiusKm);
 assert.ok(keplerTransferPoint(1).radiusKm>380000);
 assert.ok(Number.isFinite(middle.x)&&Number.isFinite(middle.y));
});

test("3D science visualization supports pan, zoom, Kepler timing and changing Moon direction",()=>{
 const source=readFileSync(new URL("../web/orbit-visualization.mjs",import.meta.url),"utf8");
 for(const expected of ["orbit-3d-canvas","cameraProject","pointermove","shiftKey","wheel","moonEphemeris","keplerTransferPoint","catalogAgeDays","NOT COLA screening"]){
  assert.ok(source.includes(expected),expected);
 }
});
