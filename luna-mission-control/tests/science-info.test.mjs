import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {renderScientificInformation,renderScenarioInfo} from "../web/science-info.mjs";

const fixture={
 site:{latitude:-89.5,longitude:0},
 quality:{
  ephemeris:"NASA/JPL Horizons cached geometry",
  horizons_direct_validation:"54 direct observations",
  diviner_observations:"337 historical Diviner bins",
  thermal_model_mean_abs_error_c:47.79
 },
 terrain:{coverage:true,detail_coverage:true,elevation_km:-0.722,detail_slope_deg:6.7},
 regional_horizon:{max_obstruction_deg:9.97,near_field_resolved:true},
 rover_route:{available:false}
};

test("Scientific information is organized into readable source sections",()=>{
 const html=renderScientificInformation(fixture,null);
 for(const expected of [
  "NASA sources and validation","Terrain and rover screening",
  "Temperatures and historical observations","Communications and seismic limits",
  "54 direct observations","337 historical Diviner bins",
  "6.7°","9.97°","47.79 °C",
  "NOT assessed","not a certified spacecraft temperature prediction",
  "JPL Horizons","NASA LOLA","Apollo seismic archive"
 ])assert.ok(html.includes(expected),expected);
});

test("Comparisons get separate scenario detail panels",()=>{
 const html=renderScientificInformation(fixture,{
  original:fixture,recommended:{...fixture,site:{latitude:-89.2,longitude:32}},
  search:"site search",comparison_note:"Nominal vs alternate"
 });
 assert.match(html,/Original selection/);
 assert.match(html,/Recommended alternative/);
 assert.match(html,/Nominal vs alternate/);
});

test("Dynamic labels and source strings are HTML escaped",()=>{
 const html=renderScenarioInfo({...fixture,quality:{ephemeris:'<img src=x onerror=alert(1)>'}},'<b>untrusted</b>');
 assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
 assert.ok(html.includes("&lt;b&gt;untrusted&lt;/b&gt;"));
 assert.ok(!html.includes('<img src=x'));
});

test("Main results no longer contain long amber technical paragraphs",()=>{
 const app=readFileSync(new URL("../web/app.js",import.meta.url),"utf8");
 assert.ok(app.includes("scienceInfoDrawer"));
 assert.ok(app.includes("scienceInfoEdge"));
 assert.ok(app.includes("renderScientificInformation(lastResult,comparison)"));
 assert.ok(!app.includes('<div class="note">PROJECTED regolith'));
 assert.ok(!app.includes("No NASA 20-m terrain patch for rover corridor screening at this coordinate.</p></div>"));
});
