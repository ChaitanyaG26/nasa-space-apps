import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {simulateWithGeometry} from "../web/static-engine.mjs";
import {regionalTerrain} from "../web/lola-terrain.mjs";
import {verifyReferenceDataset,atUtc,localAngles,geometryAtUtc,referencePreview,geometrySeries,centerPositionsAtUtc,vectorsForSite,surfacePosition,utcMillis} from "../web/horizons-static.mjs";
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

test("Timestamp normalizer accepts numeric milliseconds, Date and ISO UTC",()=>{
  const instant="2026-12-09T03:20:00Z";
  const ms=Date.parse(instant);
  assert.equal(utcMillis(ms),ms);
  assert.equal(utcMillis(new Date(instant)),ms);
  assert.equal(utcMillis(instant),ms);
  assert.throws(()=>utcMillis("12/09/2026 03:20"),/ISO-8601/);
});
test("Real NASA Horizons cache simulates December 9 2026 at 53.716 S 64.389 W",()=>{
  const json=readFileSync(new URL("../web/assets/horizons-moon-reference.json",import.meta.url),"utf8");
  const cached=verifyReferenceDataset(JSON.parse(json));
  const request={
    latitude:-53.716,longitude:-64.389,landing_time:"2026-12-09T03:20:00Z",
    duration_days:7,area_m2:1.6,panel_tilt_deg:60,panel_az_deg:0,
    battery_wh:5000,load_w:75,reserve_percent:20,data_mode:"horizons"
  };
  const series=geometrySeries(cached,request,0);
  assert.equal(series.length,169);
  assert.equal(series[0].time,"2026-12-09T03:20:00.000Z");
  assert.equal(series.at(-1).time,"2026-12-16T03:20:00.000Z");
  assert.ok(series.every(row=>Number.isFinite(row.sun_el)&&Number.isFinite(row.earth_el)));
  const result=simulateWithGeometry(request,series,"NASA JPL Horizons, simulated regression");
  assert.equal(result.samples.length,169);
  assert.ok(result.samples.every(row=>Number.isFinite(row.power_w)&&Number.isFinite(row.soc)));
  assert.ok(result.metrics.earth_hours>=0&&result.metrics.earth_hours<=168);
  assert.ok(result.metrics.total_energy_wh>=0);
});
test("NASA LOLA data is explicitly unavailable at 53.716 S rather than fabricated",()=>{
  const json=readFileSync(new URL("../web/assets/lola-south-025deg.json",import.meta.url),"utf8");
  const terrain=regionalTerrain(JSON.parse(json),-53.716,-64.389);
  assert.equal(terrain.coverage,false);
  assert.equal(terrain.elevation_km,null);
});
