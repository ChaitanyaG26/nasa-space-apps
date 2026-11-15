import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {advancePlaybackUtc,formatPlaybackUtc} from "../web/playback-clock.mjs";
import {chartMarkup,niceDomain,resetCharts,utcTicks} from "../web/science-charts.mjs";

test("ephemeris playback advances exact UTC and crosses midnight",()=>{
 const next=advancePlaybackUtc("2026-11-20",143,3);
 assert.deepEqual(next,{date:"2026-11-21",slot:2,iso:"2026-11-21T00:20:00.000Z"});
 assert.equal(formatPlaybackUtc(72),"12:00 UTC");
 assert.equal(advancePlaybackUtc("2026-12-31",142,6).date,"2027-01-01");
 assert.throws(()=>advancePlaybackUtc("2026-02-30",12,3),/Invalid calendar/);
 assert.throws(()=>advancePlaybackUtc("2026-11-20",144,3),/Invalid UTC/);
});

test("science graphs preserve time, real extremes and missing-data breaks",()=>{
 resetCharts();
 const start=Date.parse("2026-11-20T00:00:00Z");
 const rows=Array.from({length:1600},(_,i)=>({
   time:new Date(start+i*900000).toISOString(),
   power:i===400?190:30+4*Math.sin(i/50)
 }));
 rows[900].power=null;
 const html=chartMarkup("Solar power",rows,"power",{unit:"W",zero:true});
 assert.match(html,/plot-timecursor/);
 assert.match(html,/Min /);
 assert.match(html,/Max /);
 assert.match(html,/190 W/);
 assert.equal((html.match(/class="plot-series"/g)||[]).length,2,
  "missing model values must not be joined");
 assert.match(html,/linearGradient/);
 assert.match(html,/1,599 computed samples/);
 const historical=chartMarkup("Historical",rows.slice(0,20),"power",{kind:"observed",unit:"W"});
 assert.match(historical,/observed-dots/);
 assert.doesNotMatch(historical,/class="plot-series"/);
});

test("time axes remain real UTC ticks on long simulation windows",()=>{
 const a=Date.parse("2026-11-20T00:00:00Z"),b=a+21*86400000;
 const ticks=utcTicks(a,b);
 assert.ok(ticks.length>=2);
 assert.ok(ticks.every(x=>x.time>=a&&x.time<=b));
 assert.ok(ticks.every((x,i)=>i===0||x.time>ticks[i-1].time));
 assert.deepEqual(niceDomain([0,25,75],{percent:true}).ticks,[0,20,40,60,80,100]);
});

test("globe illumination terminator follows geometric sun incidence",()=>{
 const shader=readFileSync(new URL("../web/globe.js",import.meta.url),"utf8");
 assert.match(shader,/max\(dot\(n,normalize\(sun\)\),0\.0\)/);
 assert.match(shader,/0\.29\+0\.71\*sqrt\(incidence\)/);
 assert.doesNotMatch(shader,/smoothstep\(-0\.30,0\.55/);
});
