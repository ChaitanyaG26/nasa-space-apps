import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeCatalog,demoShipPoint,keplerTransferPoint,idealTransferDays,idealizedMoonIntercept,smoothTransferFractions} from "../web/orbit-visualization.mjs";

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
 assert.match(source,/NOT COLA CLEARED/);
 assert.match(source,/metadata, NOT/);
 assert.match(source,/CACHE_MS=2\*60\*60\*1000/);
});
test("Compact sidebar keeps sky/horizon while hiding removed controls",()=>{
 const html=readFileSync(new URL("../web/index.html",import.meta.url),"utf8");
 const root=readFileSync(new URL("../../index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../web/styles.css",import.meta.url),"utf8");
 for(const page of [html,root]){
  assert.match(page,/class="sky-stack"/);
  assert.match(page,/id="orbital"/);
  assert.match(page,/id="horizon"/);
  assert.match(page,/class="toolbar-disclosure spacecraft-assumptions"/);
  assert.doesNotMatch(page,/class="toolbar-disclosure spacecraft-assumptions" open/);
  assert.match(page,/id="restartMission"/);
  assert.doesNotMatch(page,/id="optimizeMenu"/);
  assert.ok(page.indexOf('id="duration"')>page.indexOf("Spacecraft assumptions"));
  assert.ok(page.indexOf('id="restartMission"')>page.indexOf('id="optimize"'));
  for(const gone of ["mode","sampleMinutes","coords","focus"])
   assert.doesNotMatch(page,new RegExp('id="'+gone+'"'));
  for(const id of ["date","time","duration","simulate","optimize","restartMission"])
   assert.equal((page.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+" unique");
 }
 assert.match(css,/sky-stack-card/);
 assert.match(css,/scrollbar-width:none/);
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
 for(const expected of ["orbit-3d-canvas","cameraProject","pointermove","shiftKey","wheel","moonEphemeris","keplerTransferPoint","catalogAgeDays","NOT COLA CLEARED"]){
  assert.ok(source.includes(expected),expected);
 }
});

test("Animated orbit is continuously sampled and shows explicitly illustrative burns",()=>{
 const scene=readFileSync(new URL("../web/orbit-visualization.mjs",import.meta.url),"utf8");
 assert.match(scene,/smoothTransferFractions\(\)/);
 assert.match(scene,/data-orbit-burn/);
 assert.match(scene,/thrusterPhaseAt/);
 assert.match(scene,/this does not simulate propulsion/);
});

test("Idealized two-body transfer terminates exactly at the rendered Moon arrival position",()=>{
 const moon={ra:137.8,dec:-6.2,distanceKm:391200};
 const end=idealizedMoonIntercept(1,moon);
 const ra=moon.ra*Math.PI/180,dec=moon.dec*Math.PI/180;
 const target=[
  moon.distanceKm*Math.cos(dec)*Math.cos(ra),
  moon.distanceKm*Math.cos(dec)*Math.sin(ra),
  moon.distanceKm*Math.sin(dec)
 ];
 assert.ok(Math.hypot(...end.map((v,i)=>v-target[i]))<.01,"transfer endpoint must match Moon at arrival");
 const steps=smoothTransferFractions(1200);
 assert.equal(steps.length,1201);
 assert.equal(steps[0],0);
 assert.equal(steps.at(-1),1);
 assert.ok(steps.every((t,i)=>i===0||t>=steps[i-1]));
 assert.ok(steps[1]<1/1200,"fine sampling near departure removes apparent sharp kinks");
});
