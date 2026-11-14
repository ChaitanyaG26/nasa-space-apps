import test from "node:test";
import assert from "node:assert/strict";
import {niceStep,niceDomain,utcTicks,chartMarkup,resetCharts} from "../web/science-charts.mjs";
test("real axes include negative Diviner temperatures, not zero baseline",()=>{
 const d=niceDomain([-210,-150,-50]);
 assert.ok(d.min<=-210&&d.max>=-50);
 assert.ok(d.ticks.some(v=>v<0));
 assert.ok(!d.ticks.includes(0));
});
test("power and battery axes display physical units and limits",()=>{
 const p=niceDomain([0,44,79],{zero:true});
 assert.equal(p.min,0);
 assert.ok(p.max>=79);
 const s=niceDomain([28,46,88],{percent:true});
 assert.deepEqual(s.ticks,[0,20,40,60,80,100]);
});
test("UTC scale remains chronological across 35-day span",()=>{
 const a=Date.parse("2026-11-17T08:00:00Z"),b=a+35*86400000;
 const ticks=utcTicks(a,b);
 assert.ok(ticks.length>=3&&ticks.length<=8);
 assert.ok(ticks.every((t,i)=>i===0||t.time>ticks[i-1].time));
});
test("a Diviner plot renders only actual observations, with measured bins not invented curves",()=>{
 const rows=Array.from({length:5},(_,i)=>({time:new Date(Date.parse("2026-12-01T00:00Z")+i*3600000).toISOString(),
  t:i===2?null:-150+i*20}));
 resetCharts();
 const out=chartMarkup("Diviner",rows,"t",{kind:"observed",unit:"°C"});
 assert.ok(out.includes("observed-dots"));
 assert.ok(!out.includes("<path d=\"M"));
 assert.ok(out.includes("3 archival bins"));
 assert.ok(out.includes("UTC"));
});
test("model curves keep actual 30-minute samples and UTC marks",()=>{
 const rows=Array.from({length:35*48+1},(_,i)=>({time:new Date(Date.parse("2026-12-01T00:00Z")+i*1800000).toISOString(),p:30+i*.01}));
 const out=chartMarkup("Power",rows,"p",{unit:"W",zero:true});
 assert.ok(out.includes("1,681 computed samples"));
 assert.ok(out.includes("W"));
 assert.ok(out.includes("plot-grid"));
});
