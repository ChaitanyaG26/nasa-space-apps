import test from "node:test";
import assert from "node:assert/strict";
import {verifyGeocentricCache,interpolateState,geocentricAt,hermitePosition} from "../web/horizons-geocentric.mjs";

const base=Date.UTC(2026,10,15,0);
const row=(t,moonY)=>[t,384400,moonY,0,0,1,0,150000000,0,0,0,0,0];
const dataset={schema_version:1,origin:"Earth center 500@399",
 frame:"ICRF REF_PLANE=FRAME",step_hours:1,
 samples:[row(base,0),row(base+3600000,3600)]};

test("JPL geocentric vector cache validates origin, continuity and astronomical ranges",()=>{
 assert.strictEqual(verifyGeocentricCache(dataset),dataset);
 assert.throws(()=>verifyGeocentricCache({...dataset,origin:"Moon center"}));
 assert.throws(()=>verifyGeocentricCache({...dataset,samples:[row(base,0),row(base+7200000,3600)]}));
});
test("Hermite interpolation gives exact endpoints and a physically smooth midpoint",()=>{
 assert.equal(hermitePosition(0,1,3600,1,0,3600),0);
 assert.equal(hermitePosition(0,1,3600,1,1,3600),3600);
 const m=hermitePosition(0,1,3600,1,.5,3600);
 assert.ok(Math.abs(m-1800)<1e-7);
 const x=interpolateState([384400,0,0,0,1,0],[384400,3600,0,0,1,0],.5,3600);
 assert.ok(Math.abs(x.y-1800)<1e-7);
 assert.ok(Math.abs(x.vy-1)<1e-10);
});
test("Geocentric interpolator returns ICRF Moon/Sun positions and rejects out-of-range UTC",()=>{
 const v=geocentricAt(dataset,base+1800000);
 assert.ok(v.moon.distanceKm>380000&&v.moon.distanceKm<390000);
 assert.ok(Math.abs(v.moon.y-1800)<1e-7);
 assert.ok(Math.abs(v.sun.distanceKm-150000000)<1e-7);
 assert.match(v.source,/JPL Horizons/);
 assert.throws(()=>geocentricAt(dataset,base-1));
 assert.throws(()=>geocentricAt(dataset,base+7200000));
});
