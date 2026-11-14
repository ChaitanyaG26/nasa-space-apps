import test from "node:test";
import assert from "node:assert/strict";
import {verifyReferenceDataset,atUtc,localAngles,geometryAtUtc,referencePreview,geometrySeries,centerPositionsAtUtc,vectorsForSite,surfacePosition} from "../web/horizons-static.mjs";
const T=Date.parse("2026-11-20T12:00:00Z");
// Synthetic distances in km, consistent with a Moon-centered position dataset.
const EX={schema_version:2,reference:{latitude_deg:0,longitude_deg_east:0},step_hours:3,start_utc:"2026-11-20T12:00:00Z",end_utc:"2026-11-21T00:00:00Z",samples:[
 [T,0,0,149600000,0,0,384400],
 [T+3*3600000,12000000,0,149200000,12000,0,384200],
 [T+6*3600000,24000000,0,147500000,24000,0,383900],
 [T+9*3600000,36000000,0,145500000,36000,0,382700],
 [T+12*3600000,48000000,0,143000000,48000,0,380500]
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

test("Parallax is applied by subtracting the lunar observer position",()=>{
  const p=centerPositionsAtUtc(EX,T);
  const a=vectorsForSite(p,0,0),b=vectorsForSite(p,0,90);
  // The distant Sun changes much less than nearby Earth.
  const angular=(x,y)=>Math.acos(Math.max(-1,Math.min(1,x.x*y.x+x.y*y.y+x.z*y.z)))*180/Math.PI;
  assert.ok(angular(a.earth,b.earth)>0.2);
  assert.ok(angular(a.sun,b.sun)<0.01);
  assert.equal(surfacePosition(0,0).z,1737.4);
});
test("Horizons v1 directional cache is rejected rather than silently accepted",()=>{
 const v1={...EX,schema_version:1};
 assert.throws(()=>verifyReferenceDataset(v1),/v2/);
});

test("NASA LOLA height alters site-specific parallax",()=>{
 const p=centerPositionsAtUtc(EX,T);
 const a=vectorsForSite(p,-89.5,0,0);
 const b=vectorsForSite(p,-89.5,0,3.5);
 assert.notEqual(a.earth.z,b.earth.z);
});
