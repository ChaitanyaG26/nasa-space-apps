import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {LAUNCH_SITES,searchWindows} from "../web/launch-window.mjs";

test("Only the three major sites remain",()=>{
 assert.deepEqual(LAUNCH_SITES.map(s=>s.id),["ksc","ccsfs","vandenberg"]);
});
test("Different arrival dates produce distinct departure candidate windows",()=>{
 const site=LAUNCH_SITES[0],a=Date.parse("2026-11-25T12:00:00Z"),b=Date.parse("2026-12-02T12:00:00Z");
 const first=searchWindows(site,a,200,24,60,[])[0];
 const second=searchWindows(site,b,200,24,60,[])[0];
 assert.notEqual(first.launch,second.launch);
});
test("Each scenario has its own COLA hold state and output",()=>{
 const module=readFileSync(new URL("../web/launch-window.mjs",import.meta.url),"utf8");
 assert.match(module,/original:\{site:"ksc",holds:""\}/);
 assert.match(module,/optimized:\{site:"ksc",holds:""\}/);
 assert.match(module,/data-cola-scenario/);
 assert.match(module,/scenarioTarget\(scenario\)/);
 assert.match(module,/NOT VERIFIED/);
});
test("Simulation supplies structured original and optimized arrival dates",()=>{
 const app=readFileSync(new URL("../web/app.js",import.meta.url),"utf8");
 assert.match(app,/lunaLaunchScenarios/);
 assert.match(app,/arrival_time:s.data.landing_time/);
 assert.match(app,/comparison\.recommended/);
});
test("Info panel styles are scoped and version refreshed",()=>{
 const css=readFileSync(new URL("../web/styles.css",import.meta.url),"utf8");
 const index=readFileSync(new URL("../web/index.html",import.meta.url),"utf8");
 assert.match(css,/#scienceInfoDrawer \.science-info-row dd/);
 assert.match(css,/#luna-launch-cola \.launch-cola-scenarios/);
 assert.match(index,/styles\.css\?v=[A-Za-z0-9-]+/);
 assert.match(index,/app\.js\?v=[A-Za-z0-9-]+/);
});
