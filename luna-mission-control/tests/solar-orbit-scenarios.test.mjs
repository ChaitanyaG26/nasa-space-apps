import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 greenwichSiderealDegrees,earthSunAngles,sunENU,terrainNormal,sunLight,sunShadowOffset
} from "../web/solar-geometry.mjs";
import {sampleScenarioFrame,idealTransferDays} from "../web/orbit-visualization.mjs";
import {drawMissionSurface3D} from "../web/mission-surface-3d.mjs";

const DEG=Math.PI/180;
function syntheticSunAtGMST(utc,opposite=false){
 const theta=greenwichSiderealDegrees(utc)*DEG+(opposite?Math.PI:0),distance=149600000;
 return {x:distance*Math.cos(theta),y:distance*Math.sin(theta),z:0};
}
test("JPL ICRF solar geometry produces zenith and nadir at the right UTC sidereal orientation",()=>{
 const utc=Date.UTC(2026,11,12,12);
 const zenith=earthSunAngles(syntheticSunAtGMST(utc),utc,0,0);
 const nadir=earthSunAngles(syntheticSunAtGMST(utc,true),utc,0,0);
 assert.ok(zenith.elevationDeg>89.99);
 assert.ok(nadir.elevationDeg< -89.99);
 assert.ok(zenith.distanceKm>149e6);
 assert.throws(()=>earthSunAngles({x:1,y:2,z:3},utc,28,-80));
});
test("ENU sunlight and terrain gradient determine physically oriented illumination",()=>{
 const east=sunENU({azimuthDeg:90,elevationDeg:0});
 assert.ok(Math.abs(east.e-1)<1e-12);
 assert.ok(Math.abs(east.n)<1e-12);
 const sloped=[{e:0,n:0,h:0},{e:10,n:0,h:10},{e:10,n:-10,h:10},{e:0,n:-10,h:0}];
 const normal=terrainNormal(sloped);
 assert.ok(normal.e < -.7+1e-9);
 const west={azimuthDeg:270,elevationDeg:20};
 const sunriseEast={azimuthDeg:90,elevationDeg:20};
 assert.ok(sunLight(normal,west)>sunLight(normal,sunriseEast));
 assert.equal(sunLight(normal,{azimuthDeg:0,elevationDeg:-5},{ambient:.18,diffuse:.82}),.18);
 assert.equal(sunLight(normal,null),.59);
});
test("Sun-driven shadow is opposite the projected sunlight and absent below the horizon",()=>{
 const a=sunShadowOffset(30,{azimuthDeg:90,elevationDeg:45});
 assert.ok(Math.abs(a.e+30)<.001);
 assert.ok(Math.abs(a.n)<.001);
 assert.equal(sunShadowOffset(50,{azimuthDeg:0,elevationDeg:-2}),null);
});
test("3D landing scene draws Sun glow and directed shadows only when geometric Sun is above horizon",()=>{
 const calls=[];
 const context={
  fillStyle:"#000",strokeStyle:"#000",lineWidth:1,
  createLinearGradient(){return {addColorStop(){}};},
  createRadialGradient(){calls.push("solar-glow");return {addColorStop(){}};},
  fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},
  fill(){calls.push(this.fillStyle);},stroke(){},quadraticCurveTo(){},arc(){},
 };
 const grid={center:0,footprintM:440,coverage:1,rows:Array.from({length:3},(_,j)=>
  Array.from({length:3},(_,i)=>({e:(i-1)*220,n:(1-j)*220,h:0})))};
 drawMissionSurface3D(context,{grid,kind:"landing",altitudeM:70,
  sun:{azimuthDeg:115,elevationDeg:12}});
 assert.ok(calls.includes("solar-glow"));
 assert.ok(calls.includes("#02071172"));
 calls.length=0;
 drawMissionSurface3D(context,{grid,kind:"landing",altitudeM:70,
  sun:{azimuthDeg:115,elevationDeg:-10}});
 assert.ok(!calls.includes("solar-glow"));
 assert.ok(!calls.includes("#02071172"));
});
test("Scenario UTC and moving ephemeris samples drive different Moon and spacecraft positions",()=>{
 const base=Date.UTC(2026,11,10,0,0);
 const moonAt=utc=>({
  ra:45+(utc-base)/86400000*13.2,dec:4*Math.sin((utc-base)/86400000),
  distanceKm:383000+900*Math.sin((utc-base)/86400000)
 });
 const sunAt=utc=>({ra:105+(utc-base)/86400000,dec:-23,distanceKm:149600000});
 const days=idealTransferDays();
 const s1={departureUtc:base,flightDays:days,parkingKm:200};
 const s2={departureUtc:base+7*86400000,flightDays:days,parkingKm:200};
 const a=sampleScenarioFrame(s1,.45,moonAt,sunAt);
 const b=sampleScenarioFrame(s2,.45,moonAt,sunAt);
 assert.equal(a.utc,base+.45*days*86400000);
 assert.ok(Math.abs(a.moon.ra-b.moon.ra)>80);
 assert.ok(Math.hypot(...a.spacecraftKm.map((v,i)=>v-b.spacecraftKm[i]))>100000);
 assert.ok(a.sun&&b.sun&&a.sun.ra!==b.sun.ra);
 assert.ok(Math.abs(Math.hypot(...sampleScenarioFrame(s1,1,moonAt).spacecraftKm)-
  sampleScenarioFrame(s1,1,moonAt).arrivalMoon.distanceKm)<.01);
});
test("Per-scenario launch/landing light uses each frame UTC and JPL cache, not one static Sun",()=>{
 const scenes=readFileSync(new URL("../web/mission-sequences.mjs",import.meta.url),"utf8");
 const launch=readFileSync(new URL("../web/launch-window.mjs",import.meta.url),"utf8");
 const orbit=readFileSync(new URL("../web/orbit-visualization.mjs",import.meta.url),"utf8");
 for(const signal of [
  "sunAtLaunch(progress.launch)","sunAtLanding(t)","earthSunAngles(",
  "geometryAtUtc(lunarSolarCache","loadGeocentricVectors()","setTimeline("])
  assert.ok(scenes.includes(signal),signal);
 for(const signal of ["preservePlayback:true","sequenceController?.setTimeline","departureUtc:arrival-days*DAY"])
  assert.ok(launch.includes(signal),signal);
 for(const signal of ["sampleScenarioFrame(scene,t,ephemAt)","officialCoverageAt",
  "sunEphemeris(when)"])assert.ok(orbit.includes(signal),signal);
});
