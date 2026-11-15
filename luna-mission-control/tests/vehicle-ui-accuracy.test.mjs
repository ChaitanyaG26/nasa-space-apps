import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {VEHICLE_SPECS,assessVehicle,checkPayloadMass} from "../web/vehicle-performance.mjs";
import {distanceOnEarthMoonView} from "../web/orbit-visualization.mjs";

test("Manufacturer-derived liftoff screening is distinct from spacecraft coast orbit",()=>{
 const a=assessVehicle("falcon9",500);
 const b=assessVehicle("falcon9",2000);
 assert.equal(a.known,true);
 assert.equal(a.payloadLEOKg,22800);
 assert.ok(a.initialTwrProxy>1&&a.initialTwrProxy<2);
 assert.ok(b.initialTwrProxy<a.initialTwrProxy);
 assert.ok(Math.abs(a.massProxyKg-(VEHICLE_SPECS.falcon9.massKg+500))<1e-5);
 assert.equal(a.preliminaryLEOCheck,"WITHIN PUBLISHED LEO LIMIT");
 assert.equal(assessVehicle("falcon9",24000).preliminaryLEOCheck,"EXCEEDS PUBLISHED LEO LIMIT");
 assert.match(a.limitation,/No fuel flow/);
});
test("Missing engine mass and thrust data never turn into fabricated performance",()=>{
 const alpha=assessVehicle("alpha",200);
 assert.equal(alpha.known,true);
 assert.equal(alpha.initialTwrProxy,null);
 assert.equal(alpha.massProxyKg,null);
 assert.equal(alpha.thrustN,null);
 assert.equal(alpha.preliminaryLEOCheck,"WITHIN PUBLISHED LEO LIMIT");
 const vulcan=assessVehicle("vulcan",500);
 assert.equal(vulcan.known,false);
 assert.equal(vulcan.initialTwrProxy,null);
 assert.equal(vulcan.preliminaryLEOCheck,"INSUFFICIENT DATA");
 assert.throws(()=>checkPayloadMass(-1));
 assert.throws(()=>checkPayloadMass("unknown"));
});
test("Earth–Moon view preserves separation ratios; distant Sun is never a nearby sphere",()=>{
 const dMoon=384400,dSun=149598262;
 assert.equal(distanceOnEarthMoonView(dMoon,dMoon),210);
 assert.ok(distanceOnEarthMoonView(dSun,dMoon)>80000);
 assert.ok(Math.abs(distanceOnEarthMoonView(dMoon/2,dMoon)-105)<1e-9);
 const orbit=readFileSync(new URL("../web/orbit-visualization.mjs",import.meta.url),"utf8");
 assert.match(orbit,/SUN • OFF-FRAME/);
 assert.doesNotMatch(orbit,/bubble\\(sun,/);
 assert.match(orbit,/sunDistanceKm/);
});
test("Professional dashboard omits sky playback and graph sequence numerals",()=>{
 const app=readFileSync(new URL("../web/app.js",import.meta.url),"utf8");
 const page=readFileSync(new URL("../web/index.html",import.meta.url),"utf8");
 assert.doesNotMatch(app,/playEphemeris/);
 assert.doesNotMatch(app,/metric-sequence/);
 assert.doesNotMatch(page,/01 \\/ MISSION TIME/);
 assert.match(page,/Mission timing/);
 assert.match(page,/20261114-physics-ui-v10/);
});
