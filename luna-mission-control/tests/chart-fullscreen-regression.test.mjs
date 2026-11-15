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
  assert.match(html,/styles\.css\?v=20261115-fullscreen-v21/);
  assert.match(html,/app\.js\?v=20261115-fullscreen-v21/);
 }
 assert.match(read("web/app.js"),/science-charts\.mjs\?v=20261115-fullscreen-v21/);
});
