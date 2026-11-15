import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("Single scenario uses 2x4 metric grid, comparison doubles it to 4x4",()=>{
 const app=readFileSync(new URL("../web/app.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../web/styles.css",import.meta.url),"utf8");
 assert.match(app,/scenario-plot-grid/);
 assert.match(app,/cards scenario-compare/);
 assert.match(app,/metricSlot\(8,"earth"/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\);grid-template-rows:repeat\(4/);
 assert.match(css,/\.cards\.scenario-compare\{grid-template-columns:repeat\(2/);
});
test("Charts use expandable panels and synchronized UTC cursors",()=>{
 const s=readFileSync(new URL("../web/science-charts.mjs",import.meta.url),"utf8");
 assert.match(s,/class="plot-expand"/);
 assert.match(s,/setChartsCursor\(root,new Date\(p.time\)\.toISOString\(\)\)/);
 assert.match(s,/chart-expanded/);
});
test("UI palette has night, blue and golden-yellow accents",()=>{
 const css=readFileSync(new URL("../web/styles.css",import.meta.url),"utf8");
 for(const key of ["--luna-night","--luna-blue","--luna-gold"])assert.ok(css.includes(key));
});
