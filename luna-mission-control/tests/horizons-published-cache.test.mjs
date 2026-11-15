import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifyGeocentricCache,geocentricAt} from "../web/horizons-geocentric.mjs";

const sourcePath=new URL("../web/assets/horizons-geocentric-icrf.json",import.meta.url);
test("Published JPL ICRF Moon/Sun cache exists with verified hourly position/velocity records",()=>{
 const data=JSON.parse(readFileSync(sourcePath,"utf8"));
 assert.strictEqual(verifyGeocentricCache(data),data);
 assert.ok(data.samples.length>3500);
 assert.match(data.source_url,/jpl\\.nasa\\.gov/);
 assert.equal(data.schema_version,1);
 assert.ok(data.generated_utc);
 const first=data.samples[0][0],last=data.samples.at(-1)[0];
 assert.ok(last-first>100*86400000);
 for(const time of [first,first+5*86400000,Math.floor((first+last)/7200000)*3600000,last]){
  const state=geocentricAt(data,time);
  assert.ok(state.moon.distanceKm>300000&&state.moon.distanceKm<450000);
  assert.ok(state.sun.distanceKm>130000000&&state.sun.distanceKm<160000000);
  assert.ok(Number.isFinite(state.moon.ra)&&Number.isFinite(state.sun.dec));
 }
});
test("LUNA launch and orbit views activate Horizons position/velocity data with fallback labels",()=>{
 const launch=readFileSync(new URL("../web/launch-window.mjs",import.meta.url),"utf8");
 const orbit=readFileSync(new URL("../web/orbit-visualization.mjs",import.meta.url),"utf8");
 assert.match(launch,/loadGeocentricVectors/);
 assert.match(launch,/geocentricAt/);
 assert.match(launch,/moonPosition/);
 assert.match(orbit,/setEphemerides/);
 assert.match(orbit,/outside the JPL cache window/);
 assert.match(orbit,/approximate theory/);
});
