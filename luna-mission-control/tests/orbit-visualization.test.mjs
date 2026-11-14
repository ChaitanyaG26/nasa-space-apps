import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeCatalog,demoShipPoint} from "../web/orbit-visualization.mjs";

test("Public OMM catalog metadata is filtered, not treated as conjunction screening",()=>{
 const entries=[{OBJECT_NAME:"ISS",NORAD_CAT_ID:25544,EPOCH:"2026-11-14T12:00:00",MEAN_MOTION:15.5},
  {OBJECT_NAME:"unknown",NORAD_CAT_ID:"bad",EPOCH:"invalid"}];
 const items=normalizeCatalog(entries);
 assert.equal(items.length,1);
 assert.equal(items[0].id,"25544");
});
test("Schematic ship path has finite endpoints and intermediate positions",()=>{
 const a=demoShipPoint(0),b=demoShipPoint(1),mid=demoShipPoint(.5);
 assert.deepEqual(a,{x:102,y:151});
 assert.deepEqual(b,{x:544,y:131});
 assert.ok(mid.x>a.x&&mid.x<b.x&&Number.isFinite(mid.y));
});
test("Catalog display never asserts an operational avoidance solution",()=>{
 const source=readFileSync(new URL("../web/orbit-visualization.mjs",import.meta.url),"utf8");
 assert.match(source,/NOT COLA screening/);
 assert.match(source,/not real-time propagated coordinates/);
 assert.match(source,/CACHE_MS=2\*60\*60\*1000/);
});
test("Sidebar always exposes last action and optimization appears in results header",()=>{
 const html=readFileSync(new URL("../web/index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../web/styles.css",import.meta.url),"utf8");
 assert.match(html,/<footer class="sidebar-actions"><button id="simulate"/);
 assert.match(html,/results-optimize/);
 assert.ok(html.indexOf('id="optimize"')>html.indexOf('id="resultsPage"'));
 assert.match(css,/sidebar \.sidebar-actions #simulate/);
});
