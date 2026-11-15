import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 sunToMoonView,haloLimbStrength,drawLunarLimbHalo
} from "../web/lunar-limb-halo.mjs";

const nearly=(a,b)=>Math.abs(a-b)<1e-10;

test("Sun vector rotates with globe camera identically to lunar surface shading",()=>{
 const right=sunToMoonView([1,0,0],0,0);
 const left=sunToMoonView([1,0,0],Math.PI,0);
 assert.ok(nearly(right[0],1));
 assert.ok(nearly(left[0],-1));
 const top=sunToMoonView([0,1,0],0,0);
 assert.ok(nearly(top[1],1));
 assert.equal(sunToMoonView([0,0,0],0,0),null);
});
test("Golden limb glow follows lit hemisphere and disappears on opposite limb",()=>{
 const right=sunToMoonView([1,0,0],0,0);
 assert.ok(haloLimbStrength(right,0)>.85);
 assert.equal(haloLimbStrength(right,Math.PI),0);
 const left=sunToMoonView([1,0,0],Math.PI,0);
 assert.ok(haloLimbStrength(left,Math.PI)>.85);
 assert.equal(haloLimbStrength(left,0),0);
 const top=sunToMoonView([0,1,0],0,0);
 assert.ok(haloLimbStrength(top,-Math.PI/2)>.85);
 assert.equal(haloLimbStrength(top,Math.PI/2),0);
});
test("Full face-on illumination has only a subtle symmetric rim; backlit disk has none",()=>{
 const full=sunToMoonView([0,0,1],0,0);
 const newMoon=sunToMoonView([0,0,-1],0,0);
 assert.ok(haloLimbStrength(full,0)>0);
 assert.ok(haloLimbStrength(full,0)<.2);
 assert.equal(haloLimbStrength(newMoon,0),0);
 assert.equal(haloLimbStrength(newMoon,Math.PI),0);
});
test("Halo renderer clears every frame and draws only illuminated rim arcs",()=>{
 const arcs=[];
 const ctx={
  clearRect(...args){arcs.push(["clear",...args]);},
  save(){},restore(){},beginPath(){},
  arc(...args){arcs.push(["arc",...args]);},
  stroke(){arcs.push(["stroke",this.strokeStyle]);},
  set lineCap(v){},set lineWidth(v){},set shadowBlur(v){},
  set shadowColor(v){},set strokeStyle(v){this._strokeStyle=v;},
  get strokeStyle(){return this._strokeStyle;},
 };
 drawLunarLimbHalo(ctx,{width:500,height:400,zoom:.75,sunView:[1,0,0]});
 assert.deepEqual(arcs[0],["clear",0,0,500,400]);
 const lit=arcs.filter(a=>a[0]==="stroke");
 assert.ok(lit.length>50 && lit.length<170);
 assert.ok(lit.some(a=>a[1].includes("255,211,110")));
 arcs.length=0;
 drawLunarLimbHalo(ctx,{width:500,height:400,zoom:.75,sunView:[0,0,-1]});
 assert.deepEqual(arcs, [["clear",0,0,500,400]]);
});
test("Moon WebGL canvas and halo share a redraw and compositing stack",()=>{
 const globe=readFileSync(new URL("../web/globe.js",import.meta.url),"utf8");
 const css=readFileSync(new URL("../web/styles.css",import.meta.url),"utf8");
 assert.match(globe,/parent\.insertBefore\(haloCanvas,canvas\)/);
 assert.match(globe,/sunToMoonView\(sun,yaw,pitch\)/);
 assert.match(globe,/drawLunarLimbHalo\(haloContext/);
 assert.match(globe,/setSun\(x,y,z\)\{sun=\[x,y,z\];draw\(\)\}/);
 assert.match(globe,/gl\.clearColor\(0,0,0,0\)/);
 assert.match(css,/\.map-page \.lunar-limb-halo/);
 assert.match(css,/\.map-page::before\{\s*background:radial-gradient\(ellipse at 50% 52%/);
});
