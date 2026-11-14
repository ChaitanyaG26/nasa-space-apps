import test from "node:test";
import assert from "node:assert/strict";
import {THERMAL_DEFAULTS,RADIO_DEFAULTS,thermalParameters,radioParameters,thermalStep,radioLinkBudget} from "../web/engineering-models.mjs";
import {simulateWithGeometry} from "../web/static-engine.mjs";
test("RF free-space attenuation follows range squared and frequency squared",()=>{
 const a=radioLinkBudget(384400),b=radioLinkBudget(768800);
 assert.ok(a.path_loss_db>200&&a.path_loss_db<225);
 assert.ok(Math.abs(b.path_loss_db-a.path_loss_db-20*Math.log10(2))<1e-10);
 assert.ok(Math.abs(a.margin_db-b.margin_db-20*Math.log10(2))<1e-10);
});
test("RF margin responds correctly to rate and transmitter power assumptions",()=>{
 const a=radioLinkBudget(384400),b=radioLinkBudget(384400,{rf_bitrate_bps:100000});
 assert.ok(Math.abs(a.margin_db-b.margin_db-10)<1e-10);
 const c=radioLinkBudget(384400,{rf_tx_w:50});
 assert.ok(Math.abs(c.margin_db-a.margin_db-10)<1e-10);
 assert.equal(radioLinkBudget(null),null);
});
test("RF parameters refuse invalid input instead of fabricating link values",()=>{
 assert.throws(()=>radioLinkBudget(0),/Earth range/);
 assert.throws(()=>radioParameters({rf_bitrate_bps:0}),/RF assumption/);
 assert.throws(()=>radioParameters({rf_ground_gt_dbk:"not-a-number"}),/RF assumption/);
});
test("One-node thermal balance cools against cold regolith without internal heating",()=>{
 const r=thermalStep(273.15+20,-173,0,0,0,{...THERMAL_DEFAULTS,heater_w:0},true);
 assert.ok(r.temp_c<20);assert.ok(r.temp_c>-273.15);
 assert.equal(r.average_heater_w,0);
});
test("Thermostat draws energy and changes node temperature relative to no heater",()=>{
 const args=[273.15-15,-100,0,0,0];
 const base=thermalStep(...args,{...THERMAL_DEFAULTS,heater_w:0});
 const heat=thermalStep(...args,{...THERMAL_DEFAULTS,heater_setpoint_c:10,heater_w:80});
 assert.ok(heat.temp_c>base.temp_c);
 assert.ok(heat.heater_energy_wh>0&&heat.heater_energy_wh<=80);
});
test("One-node thermal parameters are explicitly bounded assumptions",()=>{
 assert.throws(()=>thermalParameters({thermal_capacity_j_k:0}),/thermal assumption/);
 assert.throws(()=>thermalParameters({operational_min_c:20,operational_max_c:10}),/min must be below max/);
});
const mission={latitude:-89.5,longitude:0,landing_time:"2026-12-12T12:00:00Z",
 duration_days:1,area_m2:1.6,panel_tilt_deg:0,panel_az_deg:0,battery_wh:5000,load_w:75,reserve_percent:20,data_mode:"demo"};
function geometry(earthDistance=384400){
 const st=Date.parse(mission.landing_time);
 return Array.from({length:25},(_,i)=>({time:new Date(st+i*3600000).toISOString(),
 sun_az:0,sun_el:0,earth_az:0,earth_el:10,sun_distance_km:149597870.7,earth_distance_km:earthDistance}));
}
test("Simulation includes projected thermal, RF margin, heater loads and clear provenance",()=>{
 const out=simulateWithGeometry(mission,geometry(),"NASA/JPL geometry synthetic checks");
 assert.equal(out.samples.length,25);
 assert.ok(out.samples.every(x=>Number.isFinite(x.lander_temperature_c)));
 assert.ok(out.samples.every(x=>Number.isFinite(x.rf_margin_db)));
 assert.ok(out.samples.every(x=>typeof x.rf_link_available==="boolean"));
 assert.ok(out.metrics.heater_consumption_wh>=0);
 assert.ok(out.metrics.predicted_rf_link_hours>=0&&out.metrics.predicted_rf_link_hours<=24);
 assert.match(out.quality.lander_thermal,/NOT VALIDATED/);
 assert.match(out.quality.communication,/PROJECTED/);
});
test("Radio link unavailable without NASA Earth range; never inferred from direction alone",()=>{
 const out=simulateWithGeometry(mission,geometry().map(({earth_distance_km,...v})=>v),"synthetic geometry");
 assert.equal(out.metrics.predicted_rf_link_hours,null);
 assert.ok(out.samples.every(x=>x.rf_link_available===null));
 assert.ok(out.samples.every(x=>x.rf_margin_db===null));
});
test("Radio link does not pass when geometric Earth visibility is blocked by a ridge",()=>{
 const ridge={coverage:true,horizon:new Array(72).fill(20),bearing_step_deg:5,max_range_km:120};
 const out=simulateWithGeometry(mission,geometry(),"synthetic geometry",null,ridge);
 assert.ok(out.samples.every(x=>x.rf_link_available===false));
 assert.equal(out.metrics.predicted_rf_link_hours,0);
});
test("Battery includes projected thermostat electric draw",()=>{
 const noHeater=simulateWithGeometry({...mission,heater_w:0},geometry(),"synthetic");
 const heating=simulateWithGeometry({...mission,heater_w:250,heater_setpoint_c:30},geometry(),"synthetic");
 assert.ok(heating.metrics.heater_consumption_wh>0);
 assert.ok(heating.samples.at(-1).battery_wh<noHeater.samples.at(-1).battery_wh);
});
