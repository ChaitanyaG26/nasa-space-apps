import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chartMarkup} from "../web/science-charts.mjs";
const file=name=>readFileSync(new URL("../web/"+name,import.meta.url),"utf8");

test("Every left-column metric shares one exact dark blue and every right-column metric shares one exact light blue",()=>{
 const app=file("app.js"),css=file("styles.css");
 assert.match(app,/SCIENCE_GRAPH_PALETTE=Object\.freeze\(\{left:"#184a78",right:"#6bb8e8"\}\)/);
 for(const metric of ["Solar generation","Regolith temperature","Heater power"]){
  const match=app.split("\n").find(line=>line.includes('chart("'+metric+'"'));
  assert.ok(match&&match.includes("SCIENCE_GRAPH_PALETTE.left"),metric);
 }
 assert.match(app,/plotMeasured\(s,"diviner_observed_c",SCIENCE_GRAPH_PALETTE\.left\)/);
 for(const metric of ["Battery charge","Lander thermal model","S-band RF margin"]){
  const match=app.split("\n").find(line=>line.includes('chart("'+metric+'"'));
  assert.ok(match&&match.includes("SCIENCE_GRAPH_PALETTE.right"),metric);
 }
 assert.match(app,/earth_clearance_deg"[\s\S]{0,150}color:"#6bb8e8"/);
 assert.match(css,/--luna-plot-left:#184a78;--luna-plot-right:#6bb8e8/);
 assert.match(css,/metric-slot:nth-child\(odd\)/);
 assert.match(css,/metric-slot:nth-child\(even\)/);
});
test("Chart renderer respects one exact color in both regular and threshold-highlighted segments",()=>{
 const rows=[0,1,2,3].map(i=>({
  time:new Date(Date.UTC(2026,10,20,i)).toISOString(),
  p:i*5,clearance:i-1
 }));
 const left=chartMarkup("Left",rows,"p",{color:"#184a78"});
 const right=chartMarkup("Right",rows,"clearance",
  {color:"#6bb8e8",threshold:0,highlightAbove:true});
 assert.match(left,/stroke="#184a78"/);
 assert.match(right,/plot-active-series/);
 assert.match(right,/stroke="#6bb8e8"/);
 assert.match(right,/fill="#6bb8e8" opacity="\.09"/);
 assert.match(right,/class="plot-threshold"/);
});
test("Before comparing, one mission and both sequences use full available horizontal width",()=>{
 const css=file("styles.css"),app=file("app.js");
 assert.match(app,/cards scenario-single/);
 assert.match(css,/\.cards\.scenario-single\{display:grid!important;grid-template-columns:minmax\(0,1fr\)!important/);
 assert.match(css,/\.launch-cola-scenarios:has\(>\.launch-cola-scenario:only-child\)/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.launch-cola-scenarios:has\(>\.launch-cola-scenario:only-child\) \.sequence-panel canvas/);
});
test("The Moon backlight is behind a transparent WebGL globe, not a fabricated ephemeris light",()=>{
 const css=file("styles.css"),globe=file("globe.js");
 assert.match(globe,/alpha:true/);
 assert.match(globe,/gl\.clearColor\(0,0,0,0\)/);
 assert.match(css,/\.sidebar-layout \.map-page::before/);
 assert.match(css,/radial-gradient\(circle closest-side at 50% 50%/);
 assert.match(css,/rgba\(255,206,100,\.29\)/);
 assert.match(css,/\.map-page #globe\{position:relative;z-index:1;background:transparent;/);
});
test("Mobile and portrait tablet share simulation engine, avoid horizontal overflow and stack navigation",()=>{
 const css=file("styles.css"),page=file("index.html");
 assert.match(css,/@media \(max-width:960px\), \(max-width:1100px\) and \(orientation:portrait\)/);
 assert.match(css,/\.sidebar-layout \.shell\{\s*display:flex!important;flex-direction:column!important/);
 assert.match(css,/\.sidebar-layout \.mission-toolbar\{\s*display:grid!important;/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/\.sidebar-layout \.mission-toolbar #restartMission\{\s*grid-column:1\/-1!important/);
 assert.match(css,/\.sidebar-layout \.results-page\{\s*flex:0 0 auto!important;width:100%!important/);
 assert.match(css,/\.sidebar-layout \.map-page\{\s*flex:0 0 auto!important/);
 assert.match(css,/@media \(max-width:620px\)\{/);
 assert.match(css,/\.scenario-plot-grid\{grid-template-columns:minmax\(0,1fr\)!important;/);
 assert.match(page,/meta name="viewport"/);
 assert.match(page,/id="globe"/);
 assert.match(page,/id="optimize"/);
});
