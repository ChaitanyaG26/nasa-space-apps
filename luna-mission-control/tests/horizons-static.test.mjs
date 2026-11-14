import test from "node:test";
import assert from "node:assert/strict";
import {verifyReferenceDataset,atUtc,localAngles,geometryAtUtc,referencePreview,geometrySeries} from "../web/horizons-static.mjs";
const T=Date.parse("2026-11-20T12:00:00Z");
const EX={schema_version:1,reference:{latitude_deg:0,longitude_deg_east:0},step_hours:3,start_utc:"2026-11-20T12:00:00Z",end_utc:"2026-11-21T00:00:00Z",samples:[
 [T,0,0,1,0,0,1],
 [T+3*3600000,0.6,0,0.8,0.6,0,0.8],
 [T+6*3600000,1,0,0,1,0,0],
 [T+9*3600000,0.6,0,-0.8,0.6,0,-0.8],
 [T+12*3600000,0,0,-1,0,0,-1]
]};
test("Reference shape and timestamp sampling",()=>assert.equal(verifyReferenceDataset(EX).samples.length,5));
test("Interpolated vectors stay normalized",()=>{
 const v=atUtc(EX,new Date(T+90*60000));
 assert.ok(Math.abs(Math.hypot(v.sun.x,v.sun.y,v.sun.z)-1)<1e-12);
});
test("Date outside coverage fails without demo fallback",()=>{
 assert.throws(()=>atUtc(EX,new Date(T-1)),/covers/);
});
test("Global directions unchanged by site while local angles differ",()=>{
 const req={landing_time:"2026-11-20T12:00:00Z",latitude:-89.5,longitude:0};
 const a=referencePreview(EX,req),b=referencePreview(EX,{...req,latitude:0,longitude:90});
 assert.deepEqual(a.global,b.global);
 assert.notDeepEqual([a.sun_az,a.sun_el],[b.sun_az,b.sun_el]);
});
test("Local coordinate projection uses east-positive longitude",()=>{
 const east={x:1,y:0,z:0};
 const [az,el]=localAngles(east,0,0);
 assert.ok(Math.abs(az-90)<1e-10);
 assert.ok(Math.abs(el)<1e-10);
});
test("Mission cannot exceed JPL coverage",()=>{
 assert.throws(()=>geometrySeries(EX,{landing_time:"2026-11-20T12:00:00Z",latitude:0,longitude:0,duration_days:2}),/covers/);
});
