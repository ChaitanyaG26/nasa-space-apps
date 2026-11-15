import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=(name)=>readFileSync(new URL("../web/"+name,import.meta.url),"utf8");

test("Three scenarios remain visible without redundant jump navigation or horizontal forced width",()=>{
 const app=src("app.js"),css=src("styles.css");
 assert.match(app,/cards scenario-triple/);
 assert.doesNotMatch(app,/data-scenario-target/);
 assert.doesNotMatch(app,/scenario-navigation"/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.cards\.scenario-triple/);
 assert.match(css,/\.launch-cola-scenarios:has/);
 assert.match(css,/overflow-x:visible!important/);
 assert.match(css,/@media\(max-width:760px\)/);
});
test("Fullscreen chart is portaled outside nested scroll containers and visually centered",()=>{
 const chart=src("science-charts.mjs"),css=src("styles.css");
 assert.match(chart,/document\.body\.appendChild\(slot\)/);
 assert.match(chart,/document\.createComment/);
 assert.match(chart,/event\.stopPropagation\(\)/);
 assert.match(chart,/closeExpandedChart/);
 assert.match(chart,/document\.addEventListener\("keydown"/);
 assert.match(css,/left:50vw!important;top:50dvh!important/);
 assert.match(css,/translate\(-50%,-50%\)!important/);
 assert.match(css,/body\.luna-chart-modal-open/);
});
test("Animation controls are centered with headings moved into their scoped information icons",()=>{
 const scene=src("mission-sequences.mjs"),css=src("styles.css");
 assert.match(scene,/Rocket launch animation/);
 assert.match(scene,/Lunar probe landing animation/);
 assert.doesNotMatch(scene,/<strong>Launch animation<\/strong>/);
 assert.doesNotMatch(scene,/<strong>Probe landing animation<\/strong>/);
 assert.match(scene,/sequence-vehicle-control/);
 assert.match(scene,/class="visually-hidden" data-label="landing"/);
 assert.match(css,/\.sequence-playback\{/);
 assert.match(css,/justify-content:center!important/);
 assert.match(css,/\.sequence-meta,\s*#luna-launch-cola \.vehicle-readout/);
});
test("Graph curves match blue LUNA palette, with gold thresholds and chosen site marker",()=>{
 const app=src("app.js"),chart=src("science-charts.mjs"),
  globe=src("globe.js"),css=src("styles.css");
 assert.doesNotMatch(app,/chart\("Solar generation",s,"power_w","#f9c74f"\)/);
 assert.match(chart,/stroke="#3a9ad2"/);
 assert.match(css,/stroke:var\(--luna-gold\)!important/);
 assert.match(css,/#optimize:disabled\{/);
 assert.match(css,/#simulate,/);
 assert.match(globe,/background:#f8d06b/);
});
test("Sun-angle ground shadows are dropped if physically too long to draw without fabricating a truncation",()=>{
 const scene=src("mission-surface-3d.mjs");
 assert.match(scene,/sunShadowOffset\(heightM,sun,Infinity\)/);
 assert.match(scene,/position\.lengthM>visibleRadius/);
 assert.match(scene,/Math\.max\(0,altitudeM\)\+rocket\.heightM/);
 assert.match(scene,/Math\.max\(0,altitudeM\)\+15/);
 assert.doesNotMatch(scene,/sunShadowOffset\(heightM,sun,footprint\*\.82\)/);
});
