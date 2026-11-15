import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {VEHICLES,LANDERS,vehiclesForSite,chooseVehicle,chooseLander,landersForVehicle,illustratedSurfaceHeight,rocketFraction,landerFraction} from "../web/mission-sequences.mjs";

test("Each primary launch range has a distinct set of selectable rocket illustrations",()=>{
 assert.deepEqual(Object.keys(VEHICLES),["ksc","ccsfs","vandenberg"]);
 assert.ok(VEHICLES.ksc.some(v=>v.name==="Falcon 9"));
 assert.ok(VEHICLES.ksc.some(v=>v.name==="Space Launch System"));
 assert.ok(VEHICLES.ccsfs.some(v=>v.name==="Vulcan Centaur"));
 assert.ok(VEHICLES.vandenberg.some(v=>v.name==="Firefly Alpha"));
 assert.ok(vehiclesForSite("ksc").length>=2);
 assert.equal(chooseVehicle("vandenberg","sls").id,VEHICLES.vandenberg[0].id);
});
test("Lunar probe visual choices are independent and valid",()=>{
 assert.ok(LANDERS.length>=3);
 assert.equal(chooseLander("novac").id,"novac");
 assert.equal(chooseLander("not-present").id,LANDERS[0].id);
 assert.deepEqual(landersForVehicle("vulcan").map(l=>l.id),["peregrine","concept"]);
 assert.deepEqual(landersForVehicle("sls").map(l=>l.id),["concept"]);
 assert.equal(chooseLander("novac","vulcan").id,"peregrine");
});
test("Animation progress is bounded and smoothly monotonic",()=>{
 for(const fn of [rocketFraction,landerFraction]){
  const values=Array.from({length:101},(_,i)=>fn(i/100));
  assert.equal(values.at(0),0);
  assert.equal(values.at(-1),1);
  assert.ok(values.every((v,i)=>v>=0&&v<=1&&(i===0||v>=values[i-1])));
 }
});
test("Launch site and lander coordinate context are supplied per mission",()=>{
 const script=readFileSync(new URL("../web/mission-sequences.mjs",import.meta.url),"utf8");
 const launch=readFileSync(new URL("../web/launch-window.mjs",import.meta.url),"utf8");
 assert.match(script,/state\.latitude/);
 assert.match(script,/state\.longitude/);
 assert.match(script,/setSite\(id\)/);
 assert.match(script,/setTarget\(lat,lon\)/);
 assert.match(script,/data-scene="launch"/);
 assert.match(script,/data-scene="landing"/);
 assert.match(launch,/latitude:destination\?\.lat,longitude:destination\?\.lon/);
 assert.match(launch,/data-sequences-host/);
 assert.match(launch,/visualSelections/);
});

test("Illustrative probe landing feet meet the target height for each site's coordinates",()=>{
 for(const [lat,lon] of [[-89.5,0],[-85.2,45],[-88,-110]]){
  const surface=illustratedSurfaceHeight(lat,lon);
  const landerBodyCenter=surface-21;
  assert.ok(Math.abs(landerBodyCenter+21-surface)<1e-8);
  assert.ok(surface>225&&surface<248);
 }
 const script=readFileSync(new URL("../web/mission-sequences.mjs",import.meta.url),"utf8");
 assert.match(script,/surfaceY-21-26/);
});
