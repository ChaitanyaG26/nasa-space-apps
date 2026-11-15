import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 sunToMoonView,haloLimbStrength,drawLunarLimbHalo,lunarHaloBitmap
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
test("Continuous halo raster is prominent and fades smoothly without segmented stroke bands",()=>{
 const right=lunarHaloBitmap({width:500,height:400,zoom:.75,sunView:[1,0,0]});
 const left=lunarHaloBitmap({width:500,height:400,zoom:.75,sunView:[-1,0,0]});
 assert.equal(right.width,500);assert.equal(right.height,400);
 const alpha=(bmp,x,y)=>bmp.pixels[(y*bmp.width+x)*4+3];
 // The visible disk radius is 150px, so the Sun-facing right limb
 // should have a bright inner bloom and a much wider amber penumbra.
 assert.ok(alpha(right,406,200)>100);
 assert.ok(alpha(right,425,200)>40);
 assert.ok(alpha(right,440,200)>22);
 assert.equal(alpha(right,100,200),0);
 assert.ok(alpha(left,100,200)>100);
 assert.equal(alpha(left,406,200),0);
 const samples=Array.from({length:35},(_,i)=>alpha(right,415+i,200));
 const diffs=samples.slice(1).map((v,i)=>Math.abs(v-samples[i]));
 assert.ok(Math.max(...diffs)<14, "Adjacent halo pixels must not form bands");
 assert.ok(samples[0]>samples.at(-1),"Golden falloff must be continuous toward space");
});
test("Full-phase halo is subtle and backlit disk has no fictional glow",()=>{
 const full=lunarHaloBitmap({width:400,height:400,zoom:.75,sunView:[0,0,1]});
 const back=lunarHaloBitmap({width:400,height:400,zoom:.75,sunView:[0,0,-1]});
 const alpha=(bmp,x,y)=>bmp.pixels[(y*bmp.width+x)*4+3];
 assert.ok(alpha(full,360,200)>0 && alpha(full,360,200)<32);
 assert.equal(alpha(back,360,200),0);
});
test("Canvas painter uses one smoothly upscaled bitmap and never draws arc strokes",()=>{
 const calls=[];
 const scratchContext={
  createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},
  putImageData(image){calls.push(["pixels",image.data.some(v=>v>0)]);}
 };
 const scratch={
  width:0,height:0,
  getContext(){return scratchContext;}
 };
 const ctx={
  canvas:{ownerDocument:{createElement:()=>scratch}},
  clearRect(...args){calls.push(["clear",...args]);},
  save(){calls.push(["save"]);},
  restore(){calls.push(["restore"]);},
  drawImage(...args){calls.push(["image",args[0]===scratch,args[3],args[4]]);}
 };
 drawLunarLimbHalo(ctx,{width:500,height:400,zoom:.75,sunView:[1,0,0]});
 assert.equal(calls.filter(x=>x[0]==="image").length,1);
 assert.ok(calls.some(x=>x[0]==="pixels"&&x[1]));
 assert.ok(!calls.some(x=>x[0]==="arc"||x[0]==="stroke"));
 calls.length=0;
 drawLunarLimbHalo(ctx,{width:500,height:400,zoom:.75,sunView:[0,0,-1]});
 assert.deepEqual(calls,[["clear",0,0,500,400]]);
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
