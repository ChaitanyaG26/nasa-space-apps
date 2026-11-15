import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
test("Expanded science plot has a document-level dialog and restores its original location",()=>{
 const src=read("web/science-charts.mjs");
 assert.match(src,/document\.body\.appendChild\(overlay\)/);
 assert.match(src,/overlay\.appendChild\(slot\)/);
 assert.match(src,/placeholder\.replaceWith\(slot\)/);
 assert.match(src,/aria-modal/);
 assert.match(src,/event\.key==="Escape"/);
 assert.match(src,/fullscreenSlot\?\.contains\(button\)/);
});
test("Fullscreen viewport overlay avoids clipping by horizontally scrolling cards",()=>{
 const css=read("web/styles.css");
 assert.match(css,/body>\.luna-chart-overlay\{/);
 assert.match(css,/position:fixed!important;inset:0!important/);
 assert.match(css,/place-items:center!important/);
 assert.match(css,/body>\.luna-chart-overlay>\.metric-slot\.fullscreen-slot/);
});
test("NASA supported date notice is upper right, away from bottom right scroll arrow",()=>{
 const css=read("web/styles.css");
 assert.match(css,/\.sidebar-layout \.toast\{[\s\S]*?top:calc\(80px/);
 assert.match(css,/bottom:auto!important/);
 assert.match(css,/\.sidebar-layout \.scroll-to-top\{/);
});
test("Published pages use current controller and CSS versions",()=>{
 for(const path of ["web/index.html","../index.html"]){
  const html=read(path);
  assert.match(html,/styles\.css\?v=20261115-optimize-progress-v26/);
  assert.match(html,/app\.js\?v=20261115-optimize-progress-v26/);
 }
 assert.match(read("web/app.js"),/science-charts\.mjs\?v=20261115-optimize-progress-v26/);
});

test("Point inspection is rendered as a separate telemetry band, not over the chart legend",()=>{
 const source=read("web/science-charts.mjs");
 assert.match(source,/plot-live-reading/);
 assert.match(source,/plot-readout-value/);
 assert.match(source,/plot-reading-time/);
 assert.match(source,/plot-reading-number/);
 assert.match(source,/pointerdown",inspectPoint/);
 const css=read("web/styles.css");
 assert.match(css,/body>\.luna-chart-overlay \.plot-tooltip\{display:none!important;/);
 assert.match(css,/body>\.luna-chart-overlay \.plot-live-reading\{/);
 assert.match(css,/body>\.luna-chart-overlay \.plot-foot-summary\{/);
 assert.match(css,/@media\(max-width:760px\)/);
});

test("Fullscreen explanation leaves the graph area and selected telemetry unobstructed",()=>{
 const source=read("web/science-charts.mjs");
 assert.match(source,/className="chart-fullscreen-explanation"/);
 assert.match(source,/disclosure\.addEventListener\("toggle",syncExplanation\)/);
 assert.match(source,/fullscreenInfoCleanup\?\.\(\)/);
 assert.match(source,/tooltip\.hidden=expanded/);
 const css=read("web/styles.css");
 assert.match(css,/body>\.luna-chart-overlay \.chart-information \.chart-info-content\{display:none!important;/);
 assert.match(css,/body>\.luna-chart-overlay \.chart-fullscreen-explanation:not\(\[hidden\]\)/);
});
test("Readable footer separates ranges, samples, and UTC start/end on phone and desktop",()=>{
 const source=read("web/science-charts.mjs");
 for(const selector of ["plot-foot-value","plot-foot-count","plot-foot-range","plot-foot-dates","plot-date-label","plot-live-reading"])assert.ok(source.includes(selector));
 const css=read("web/styles.css");
 assert.match(css,/v23: a calm, separate methodology panel/);
 assert.match(css,/@media\(max-width:800px\)/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)!important/);
});

test("Fullscreen plot keeps a larger viewport while compressing open explanations and footer",()=>{
 const css=read("web/styles.css");
 assert.match(css,/v24: compact fullscreen metadata/);
 assert.match(css,/height:min\(91dvh,920px\)!important/);
 assert.match(css,/body>\.luna-chart-overlay \.chart-fullscreen-explanation:not\(\[hidden\]\)/);
 assert.match(css,/max-height:88px!important/);
 assert.match(css,/body>\.luna-chart-overlay \.plot-wrap\{/);
 assert.match(css,/flex:1 1 auto!important/);
 assert.match(css,/@media\(max-width:800px\)/);
 assert.match(css,/height:92dvh!important/);
 assert.match(css,/grid-template-columns:minmax\(0,.85fr\) minmax\(0,1.15fr\)!important/);
});
