import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");

test("Both published entry pages have exactly one permanently visible accessible up-arrow",()=>{
 for(const file of ["web/index.html","../index.html"]){
  const html=read(file);
  assert.equal((html.match(/id="scrollToTop"/g)||[]).length,1);
  assert.match(html,/<button id="scrollToTop" class="scroll-to-top" type="button" aria-label="Scroll to top"/);
  assert.match(html,/<svg viewBox="0 0 24 24"/);
  assert.match(html,/20261114-scroll-top-v20/);
 }
});
test("Circle is fixed to the bottom-right even on short mobile screens and does not obscure the Moon legend",()=>{
 const css=read("web/styles.css");
 assert.match(css,/\.sidebar-layout \.scroll-to-top\{/);
 assert.match(css,/position:fixed!important/);
 assert.match(css,/right:calc\(18px \+ env\(safe-area-inset-right,0px\)\)/);
 assert.match(css,/bottom:calc\(18px \+ env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(css,/border-radius:50%!important/);
 assert.match(css,/\.sidebar-layout \.landing-site-legend\{bottom:98px!important/);
 assert.match(css,/@media \(max-width:620px\)/);
});
test("Up arrow scrolls document, desktop results pane and sidebar independently, respects reduced motion",()=>{
 const app=read("web/app.js");
 assert.match(app,/\$\("scrollToTop"\)\?\.addEventListener\("click"/);
 assert.match(app,/goTop\(document\.scrollingElement\)/);
 assert.match(app,/goTop\(\$\("resultsPage"\)\)/);
 assert.match(app,/goTop\(\$\("missionFields"\)\)/);
 assert.match(app,/window\.scrollTo\(\{top:0,behavior\}\)/);
 assert.match(app,/prefers-reduced-motion: reduce/);
});
