import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MOON_GRAVITY_M_S2,MOON_MEAN_RADIUS_KM,descentParameters,descentAt,normalizeTerrainProfile,profileSlopeDeg,genericAscentAt} from "../web/mission-physics.mjs";
import {transferDynamicsAt,idealTransferDays} from "../web/orbit-visualization.mjs";

test("Lunar terminal descent is physically consistent",()=>{
 const p=descentParameters();
 assert.equal(MOON_GRAVITY_M_S2,1.62);
 assert.equal(MOON_MEAN_RADIUS_KM,1737.4);
 assert.ok(p.seconds>20&&p.seconds<30);
 assert.ok(p.thrustToWeight>1&&p.thrustToWeight<2);
 const a=descentAt(0,p),middle=descentAt(.5,p),b=descentAt(1,p);
 assert.equal(a.heightM,p.altitudeM);
 assert.equal(a.downSpeedMS,p.entryDownSpeedMS);
 assert.ok(middle.heightM>0&&middle.heightM<p.altitudeM);
 assert.ok(Math.abs(b.heightM)<1e-7);
 assert.ok(Math.abs(b.downSpeedMS-p.touchDownSpeedMS)<1e-10);
 for(let i=0;i<=100;i++){
  const k=descentAt(i/100,p);
  assert.ok(k.heightM>=0&&k.downSpeedMS>=p.touchDownSpeedMS-1e-8);
 }
});
test("LOLA terrain profile validates coverage and slope",()=>{
 const profile=Array.from({length:11},(_,i)=>({offsetM:(i-5)*20,heightM:1200+(i-5)*2}));
 const m=normalizeTerrainProfile(profile);
 assert.ok(m);
 assert.equal(m.centerHeightM,1200);
 assert.ok(Math.abs(m.slopeDeg-Math.atan(.1)*180/Math.PI)<.1);
 const missing=profile.map((p,i)=>({...p,heightM:i>4?null:p.heightM}));
 assert.equal(normalizeTerrainProfile(missing),null);
 assert.equal(profileSlopeDeg(missing),null);
});
test("Ascent demonstration state is bounded and monotone",()=>{
 const v=Array.from({length:25},(_,i)=>genericAscentAt(i/24));
 assert.equal(v[0].altitudeM,0);
 assert.ok(v.every((p,i)=>p.verticalSpeedMS>=0&&(i===0||p.altitudeM>=v[i-1].altitudeM)));
});
test("Earth-centric vis-viva transfer speed decreases towards apogee",()=>{
 const options={parkingKm:200,moonDistanceKm:384400};
 const a=transferDynamicsAt(0,options),b=transferDynamicsAt(1,options);
 assert.ok(a.speedKmS>b.speedKmS);
 assert.ok(a.tliDeltaVKmS>3&&a.tliDeltaVKmS<3.3);
 assert.ok(Math.abs(a.specificEnergyKm2S2-b.specificEnergyKm2S2)<1e-12);
 assert.equal(a.flightDays,idealTransferDays(200,384400));
 assert.ok(Math.abs(b.radiusKm-384400)<1e-5);
});
test("Descent scene uses measured LOLA and cached JPL reference where available",()=>{
 const scene=readFileSync(new URL("../web/mission-sequences.mjs",import.meta.url),"utf8");
 const launch=readFileSync(new URL("../web/launch-window.mjs",import.meta.url),"utf8");
 for(const term of ["loadPolarPatch","samplePolarHeightKm","normalizeTerrainProfile","descentAt","geometryAtUtc"])
  assert.ok(scene.includes(term),term);
 assert.match(launch,/landingUtc:destination\?\.time/);
 assert.match(scene,/hazards unknown/);
 assert.match(scene,/LOLA 20 m local DEM/);
});
