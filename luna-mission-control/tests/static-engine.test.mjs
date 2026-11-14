import test from 'node:test';
import assert from 'node:assert/strict';
import {preview,simulate,optimize,solarDiskFraction,photovoltaicPower} from '../web/static-engine.mjs';
const r={latitude:-89.5,longitude:0,landing_time:'2026-11-20T12:00:00Z',duration_days:1,data_mode:'demo',area_m2:1.6,panel_tilt_deg:60,panel_az_deg:0,battery_wh:5000,load_w:75,reserve_percent:20};
test('preview is labeled illustrative',()=>{assert.match(preview(r).source,/ILLUSTRATIVE/)});
test('solar disk fractions',()=>{assert.equal(solarDiskFraction(-1),0);assert.equal(solarDiskFraction(1),1);assert.ok(Math.abs(solarDiskFraction(0)-.5)<1e-9)});
test('solar generation geometry',()=>{assert.ok(photovoltaicPower({sun_az:0,sun_el:90},{area_m2:1,panel_tilt_deg:0,panel_az_deg:0},1)>200);assert.equal(photovoltaicPower({sun_az:0,sun_el:90},{area_m2:1,panel_tilt_deg:0,panel_az_deg:0},0),0)});
test('mission series and SOC bounds',()=>{const out=simulate(r);assert.equal(out.samples.length,25);assert.ok(out.samples.every(x=>x.soc>=0&&x.soc<=100));assert.match(out.quality.terrain,/FLAT HORIZON/)});
test('site preserved',()=>{const x=optimize({mission:r,preserve:'site'});assert.deepEqual(x.original.site,x.recommended.site);assert.notEqual(x.original.landing_time,x.recommended.landing_time)});
test('time preserved',()=>{const x=optimize({mission:r,preserve:'time'});assert.equal(x.original.landing_time,x.recommended.landing_time);assert.notDeepEqual(x.original.site,x.recommended.site)});
test('unsupported Horizons mode fails clearly',()=>{assert.throws(()=>simulate({...r,data_mode:'horizons'}),/backend/)});
test('invalid latitude rejected',()=>{assert.throws(()=>simulate({...r,latitude:91}),/latitude/)});

import {moonFixedDirections,demoGeometry} from '../web/static-engine.mjs';
test('Moon-centered directions are independent of selected location',()=>{
 const a=preview(r);
 const b=preview({...r,latitude:-88.1,longitude:145});
 assert.deepEqual(a.global,b.global);
 assert.notDeepEqual([a.sun_az,a.sun_el,a.earth_az,a.earth_el],[b.sun_az,b.sun_el,b.earth_az,b.earth_el]);
});
test('Moon-centered directions change with UTC time',()=>{
 const a=moonFixedDirections('2026-11-20T12:00:00Z');
 const b=moonFixedDirections('2026-11-22T12:00:00Z');
 assert.notDeepEqual(a.sun,b.sun);
 assert.notDeepEqual(a.earth,b.earth);
 for(const dir of [a.sun,a.earth]){
   assert.ok(Math.abs(Math.hypot(dir.x,dir.y,dir.z)-1)<1e-10);
 }
});
test('local elevations agree with global radial vectors',()=>{
 const d=moonFixedDirections(r.landing_time);
 const g=demoGeometry(r.latitude,r.longitude,r.landing_time);
 const p=r.latitude*Math.PI/180,l=r.longitude*Math.PI/180;
 const up=[Math.cos(p)*Math.sin(l),Math.sin(p),Math.cos(p)*Math.cos(l)];
 const el=(v)=>Math.asin(up[0]*v.x+up[1]*v.y+up[2]*v.z)*180/Math.PI;
 assert.ok(Math.abs(el(d.sun)-g.sun_el)<1e-8);
 assert.ok(Math.abs(el(d.earth)-g.earth_el)<1e-8);
});
