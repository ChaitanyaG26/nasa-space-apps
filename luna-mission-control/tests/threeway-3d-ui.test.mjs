import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {LANDING_ORGANIZATIONS,HISTORIC_LANDING_SITES,siteVector,readableLandingTime} from "../web/landing-sites.mjs";
import {decodeTerrariumRGB,mercatorTile,loadMoonSiteGrid,projectTerrainPoint} from "../web/mission-surface-3d.mjs";
import {rotateVector} from "../web/moon-sky-3d.mjs";
import {chartMarkup} from "../web/science-charts.mjs";

test("Historical landing catalog has unique organization-coloured, grounded lunar coordinates",()=>{
 const ids=new Set();
 for(const site of HISTORIC_LANDING_SITES){
  assert.ok(!ids.has(site.id));ids.add(site.id);
  assert.ok(site.lat>=-90&&site.lat<=90);
  assert.ok(site.lon>=-180&&site.lon<=180);
  assert.ok(LANDING_ORGANIZATIONS[site.org]?.color?.startsWith("#"));
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(site.date));
  assert.ok(site.source.startsWith("https://"));
  assert.ok(readableLandingTime(site).includes("UTC")||readableLandingTime(site).includes("unverified"));
  assert.ok(Math.abs(Math.hypot(...siteVector(site.lat,site.lon))-1)<1e-12);
 }
 assert.ok(ids.size>=12);
 assert.ok(HISTORIC_LANDING_SITES.some(x=>x.lon>170),"far-side Chang’e marker included");
});
test("Earth height tile decoding uses documented Terrarium DEM format",()=>{
 assert.equal(decodeTerrariumRGB(128,0,0),0);
 assert.equal(decodeTerrariumRGB(128,10,0),10);
 assert.equal(decodeTerrariumRGB(127,255,0),-256+255);
 const t=mercatorTile(28.627,-80.621);
 assert.equal(t.z,13);assert.ok(t.x>0&&t.y>0);
 assert.ok(t.fractionX>=0&&t.fractionX<1);
});
test("3D projections vary with camera angle and preserve finite geometry",()=>{
 const first=projectTerrainPoint(20,10,30,{yaw:0,pitch:.5,zoom:1});
 const second=projectTerrainPoint(20,10,30,{yaw:Math.PI/2,pitch:.5,zoom:1});
 assert.ok(Number.isFinite(first.x)&&Number.isFinite(first.y));
 assert.notEqual(first.x,second.x);
 const rotated=rotateVector([1,0,0],Math.PI/2,0);
 assert.ok(Math.abs(Math.hypot(...rotated)-1)<1e-12);
});
test("Moon DEM must be truly available before the 3D terrain view is called measured",()=>{
 assert.equal(loadMoonSiteGrid(null,-89.5,0),null);
 const code=readFileSync(new URL("../web/mission-sequences.mjs",import.meta.url),"utf8");
 assert.match(code,/moonGrid\?\.coverage>=\.7/);
 assert.match(code,/earthGrid=sampled\?\.coverage>=\.75/);
 assert.match(code,/Elevation coverage unavailable/);
});
test("Earth clearance chart highlights above-zero segments only",()=>{
 const t=Date.parse("2026-11-20T00:00Z");
 const values=[-5,-2,1,5,-1].map((v,i)=>({time:new Date(t+i*3600000).toISOString(),earth_clearance_deg:v}));
 const html=chartMarkup("Earth clearance",values,"earth_clearance_deg",{unit:"°",threshold:0,highlightAbove:true});
 assert.match(html,/plot-active-series/);
 assert.match(html,/clipPath/);
 assert.match(html,/plot-threshold/);
 assert.match(html,/stroke="#93a6b8"/);
});
test("Three-way comparison and restart are rendered with accessible info per metric",()=>{
 const app=readFileSync(new URL("../web/app.js",import.meta.url),"utf8");
 assert.match(app,/comparison\.dateFixed/);
 assert.match(app,/comparison\.siteFixed/);
 assert.match(app,/preserve:"time"/);
 assert.match(app,/preserve:"site"/);
 assert.match(app,/CHART_EXPLANATIONS/);
 assert.match(app,/chart-information/);
 assert.match(app,/restartMission/);
 const globe=readFileSync(new URL("../web/globe.js",import.meta.url),"utf8");
 assert.match(globe,/landing-site-marker/);
 assert.match(globe,/landing-site-legend/);
 assert.match(globe,/projectHistoricMarkers/);
});
