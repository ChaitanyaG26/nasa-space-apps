import {renderScientificInformation} from "./science-info.mjs";
import "./launch-window.mjs?v=20261114-phone-scenarios-v18";
import {initGlobe} from "./globe.js?v=20261114-smooth-halo-v19";
import {createMoonSky3D} from "./moon-sky-3d.mjs?v=20261114-data-ui-v14";
import {chartMarkup,resetCharts,attachChartInteractions,utcTicks,setChartsCursor} from "./science-charts.mjs?v=20261115-legible-v23";
import {advancePlaybackUtc,formatPlaybackUtc} from "./playback-clock.mjs?v=20261114-clock-v1";
import {initTerrain3D} from "./terrain-3d.mjs?v=20261114-data-ui-v14";
import {staticApi,simulateWithGeometry,optimizeWithEngine} from "./static-engine.mjs?v=20261114-extent500-1";
import {loadJplReference,referencePreview,geometrySeries} from "./horizons-static.mjs?v=20261114-extent500-1";
import {loadLolaGlobal,siteElevation,terrainHorizon} from "./lola-global.mjs";
import {loadPolarPatch,localPatchXY,samplePolarHeightKm,polarSiteSlopeDeg,refinePolarHorizon} from "./lola-polar-detail.mjs";
import {THERMAL_PROVENANCE} from "./thermal-projection.mjs";
import {loadDivinerAtLatitude,divinerObservedReference} from "./diviner-gcp.mjs?v=gcp2-global-20261114";
const IS_PAGES = window.LUNA_STATIC_SITE === true;
let siteValidationReport=null;
async function getHorizonsValidation(){
 if(siteValidationReport)return siteValidationReport;
 try{
   const response=await fetch(new URL("./assets/horizons-direct-check.json?v=sitecheck1",import.meta.url));
   if(response.ok){
     const report=await response.json();
     if(report.schema_version===1&&report.sample_count>=24&&report.max_error_deg){
       siteValidationReport=report;
       return report;
     }
   }
 }catch(error){console.warn("Independent JPL verification report is unavailable",error);}
 return null;
}
function attachEphemerisValidation(out,report){
 if(!out?.quality)return out;
 out.quality.horizons_direct_validation=report?
   ("Direct Horizons observer cross-check: "+report.sample_count+
    " Sun/Earth observations across "+report.sites.length+" sampled lunar sites on "+
    report.time_window_utc[0].slice(0,10)+
    "; maximum angular residual Sun "+report.max_error_deg.sun+"°, Earth "+report.max_error_deg.earth+
    "°. This is not an arbitrary-site or terrain validation."):
   "Direct site-specific NASA Horizons cross-check unavailable; geometry uses Horizons cached-reference projection";
 return out;
}
// Attach ACTUAL NASA PDS historical measurements only when present.
// Do not invent values for missing bins or unsupported latitude bands.
async function attachDivinerClimatology(result,request,geom){
 try{
   const archive=await loadDivinerAtLatitude(request.latitude);
   if(!archive){
     result.quality.diviner_observations="NO NASA DIVINER GCP COVERAGE AT THIS LATITUDE — PROJECTED TEMPERATURE ONLY";
     result.samples.forEach(s=>s.diviner_observed_c=null);
     return result;
   }
   const rows=geom||[];
   let matched=0,sumError=0;
   for(let i=0;i<result.samples.length;i++){
     const row=result.samples[i];
     const reference=rows[i]?.global?.sun?
       divinerObservedReference(archive,request.latitude,request.longitude,rows[i].global.sun):null;
     row.diviner_observed_c=reference?.temperature_c??null;
     row.diviner_observation_label=reference?.status??"NO MATCHING HISTORICAL PDS BIN";
     if(reference){
       matched++;
       sumError+=Math.abs(reference.temperature_c-row.temperature_proxy_c);
     }
   }
   result.quality.diviner_observations=matched?
     "NASA LRO Diviner GCP: "+matched+" historical binned references, 2009–2015; 0.5° spatial bins, 0.25 h lunar local-time bins; NOT observed at mission UTC":
     "NASA Diviner GCP dataset loaded; no matching historical PDS bins at these local times";
   result.quality.thermal_model_mean_abs_error_c=matched?Number((sumError/matched).toFixed(2)):null;
   result.metrics.historical_temperature_samples=matched;
   return result;
 }catch(error){
   result.samples.forEach(s=>s.diviner_observed_c=null);
   result.quality.diviner_observations="NASA Diviner historical data unavailable: "+error.message;
   result.metrics.historical_temperature_samples=0;
   return result;
 }
}
const $=id=>document.getElementById(id);
let position={latitude:-89.5,longitude:0},lastMission=null,lastResult=null,comparison=null,previewSeq=0;
const globe=initGlobe($("globe"),(latitude,longitude)=>{position={latitude,longitude};showCoords();refreshPreview();});
const moonSky3D=createMoonSky3D($("orbital"));
function showCoords(){const lat=position.latitude,lon=position.longitude;const text=lat.toFixed(3)+"° "+(lat<0?"S":"N")+" · "+Math.abs(lon).toFixed(3)+"° "+(lon<0?"W":"E");$("mapCoords").textContent=text;}
function mission(){const minutes=Number($("time").value)*10;return {latitude:position.latitude,longitude:position.longitude,landing_time:$("date").value+"T"+String(Math.floor(minutes/60)).padStart(2,"0")+":"+String(minutes%60).padStart(2,"0")+":00Z",duration_days:Number($("duration").value),area_m2:Number($("area").value),panel_tilt_deg:Number($("tilt").value),panel_az_deg:Number($("az").value),battery_wh:Number($("battery").value),load_w:Number($("load").value),reserve_percent:Number($("reserve").value),sample_minutes:30,data_mode:"horizons"}}
async function api(path,data){
 if(IS_PAGES){
   const selected=(path==="optimize"?data.mission.data_mode:data.data_mode);
   if(selected==="horizons"){
     const [reference,lola]=await Promise.all([loadJplReference(),loadLolaGlobal()]);
     const initial=(path==="optimize"?data.mission:data);
     const locations=[[initial.latitude,initial.longitude]];
     if(path==="optimize")locations.push([-89.5,0],[-89.5,90],[-89.5,180],[-85,45]);
     const highRes=(await Promise.all(locations.map(([lat,lon])=>loadPolarPatch(lat,lon)))).filter(Boolean);
     const patchFor=(req)=>highRes.find(p=>{
       const [x,y]=localPatchXY(p.entry.latitude,p.entry.longitude,req.latitude,req.longitude);
       return Math.abs(x)<4900&&Math.abs(y)<4900;
     })??null;
     const terrain=(req)=>{
       const coarse=siteElevation(lola,req.latitude,req.longitude);
       const local=patchFor(req);
       const detail=samplePolarHeightKm(local,req.latitude,req.longitude);
       return detail===null?coarse:{
         ...coarse,elevation_km:Number(detail.toFixed(3)),detail_coverage:true,
         detail_slope_deg:polarSiteSlopeDeg(local,req.latitude,req.longitude),
         source:"NASA GSFC LOLA 20m high-resolution DEM patch",
         resolution:"20 meters within 10.24-km local patch; coarse LOLA outside"
       };
     };
     const horizon=(req)=>refinePolarHorizon(patchFor(req),req.latitude,req.longitude,
       terrainHorizon(lola,req.latitude,req.longitude));
     const height=(req)=>terrain(req).elevation_km??0;
     if(path==="preview"){
       const p=referencePreview(reference,data,height(data));
       p.terrain=terrain(data);
       p.regional_horizon=horizon(data);
       return p;
     }
     if(path==="simulate"){
       const geometry=geometrySeries(reference,data,height(data));
       const result=simulateWithGeometry(data,geometry,
         "NASA/JPL Horizons Sun/Earth range + direction; Moon-center parallax geometry (not site-specific query)",terrain(data),horizon(data));
       await attachDivinerClimatology(result,data,geometry);
       return attachEphemerisValidation(result,await getHorizonsValidation());
     }
     if(path==="optimize"){
       const output=optimizeWithEngine(data,req=>simulateWithGeometry(req,geometrySeries(reference,req,height(req)),
         "NASA/JPL Horizons Sun/Earth range + direction; Moon-center parallax geometry (not site-specific query)",terrain(req),horizon(req)));
       await attachDivinerClimatology(output.original,data.mission,
         geometrySeries(reference,data.mission,height(data.mission)));
       if(output.recommended){
         const candidate={...data.mission,latitude:output.recommended.site.latitude,
           longitude:output.recommended.site.longitude,landing_time:output.recommended.landing_time};
         await attachDivinerClimatology(output.recommended,candidate,
           geometrySeries(reference,candidate,height(candidate)));
       }
       const report=await getHorizonsValidation();
       attachEphemerisValidation(output.original,report);
       if(output.recommended)attachEphemerisValidation(output.recommended,report);
       return output;
     }
     throw Error("Unsupported operation: "+path);
   }
   return staticApi(path,data);
 }
 let r=await fetch("/api/"+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
 let body=await r.json();
 if(!r.ok)throw Error(typeof body.detail==="string"?body.detail:JSON.stringify(body.detail));
 return body;
}
function alertUser(text){$("toast").textContent=text;$("toast").classList.remove("hidden");setTimeout(()=>$("toast").classList.add("hidden"),6500)}
const R=Math.PI/180;
function svgText(x,y,text,color="#c5d6e3"){return '<text x="'+x+'" y="'+y+'" font-size="10" fill="'+color+'">'+text+'</text>'}
// The Moon-centered widget uses a fixed lunar frame; site selection changes
// ONLY the local horizon angles (and the separate marker on the big globe).
function updateDiagrams(p){
 const fixed=p.global;
 if(!fixed || !fixed.sun || !fixed.earth)throw Error("Global Moon-fixed geometry missing");
 moonSky3D.update(fixed);
 // Preview actual site skyline rather than a nominal flat-horizon line.
 const terrain=p.regional_horizon?.coverage&&Array.isArray(p.regional_horizon.horizon)?p.regional_horizon.horizon:null;
 const heights=terrain?.filter(Number.isFinite)||[],high=Math.max(12,p.sun_el+4,p.earth_el+4,...heights.map(v=>v+3));
 const low=Math.min(-8,p.sun_el-4,p.earth_el-4);
 const hx=az=>20+280*((az%360+360)%360)/360,hy=el=>86-(el-low)/(high-low)*69;
 const terrainAt=az=>{
  if(!terrain?.length)return null;
  const x=((az%360+360)%360)*terrain.length/360,i=Math.floor(x)%terrain.length,f=x-Math.floor(x);
  return terrain[i]*(1-f)+terrain[(i+1)%terrain.length]*f;
 };
 const path=terrain?.length?'<path d="'+Array.from({length:terrain.length+1},(_,i)=>
  (i?"L":"M")+hx(i*360/terrain.length).toFixed(2)+","+hy(terrain[i%terrain.length]).toFixed(2)).join(" ")+
  '" stroke="#60d8d0" stroke-width="2" fill="none"/>':
  '<line x1="20" y1="'+hy(0)+'" x2="300" y2="'+hy(0)+'" stroke="#809cad" stroke-dasharray="5 4"/>';
 const marker=(az,el,r,c)=>'<circle cx="'+hx(az)+'" cy="'+hy(el)+'" r="'+r+'" fill="'+c+'" stroke="#102637" stroke-width="2"/>';
 $("horizon").innerHTML=
  '<line x1="20" y1="'+hy(0)+'" x2="300" y2="'+hy(0)+'" stroke="#536c7a" stroke-dasharray="2 4"/>'+
  path+marker(p.sun_az,p.sun_el,6,"#ffc979")+marker(p.earth_az,p.earth_el,5,"#68caff")+
  svgText(12,103,"N")+svgText(87,103,"E")+svgText(159,103,"S")+svgText(232,103,"W")+svgText(292,103,"N");
 const clearance=(v,az)=>{const h=terrainAt(az);return h===null?"unknown":(v-h).toFixed(1)+"°";};
 const sunClear=clearance(p.sun_el,p.sun_az),earthClear=clearance(p.earth_el,p.earth_az);
 $("angles").innerHTML='<div><span>☀ Sun</span><b>'+p.sun_el.toFixed(1)+'°</b><small>clear '+sunClear+'</small></div>'+
  '<div><span>◉ Earth</span><b>'+p.earth_el.toFixed(1)+'°</b><small>clear '+earthClear+'</small></div>';
 const fullSource=p.source+" · "+p.global_source+(p.regional_horizon?.coverage?" · NASA LOLA regional skyline":" · Regional horizon unavailable");
 $("source").title=fullSource;
 $("source").textContent="JPL Horizons reference · "+(terrain?"LOLA terrain":"terrain coverage unknown");
 globe.setSun(fixed.sun.x,fixed.sun.y,fixed.sun.z);
}
async function refreshPreview(){const id=++previewSeq;try{const p=await api("preview",mission());if(id===previewSeq)updateDiagrams(p);return true;}catch(e){if(id===previewSeq){$("source").textContent="Reference unavailable";$("source").title=e.message;$("angles").textContent="Ephemeris unavailable";}return false;}}
function showResults(){ $("mapPage").classList.add("hidden");$("resultsPage").classList.remove("hidden")}
function showGlobe(){ closeScienceInformation(); $("mapPage").classList.remove("hidden");$("resultsPage").classList.add("hidden")}
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function chart(name,rows,key,color,maxVal){
 const unit=key==="soc"?"%":key==="rf_margin_db"?"dB":key.includes("temperature")?"°C":
  key==="heater_w"||key==="power_w"?"W":"";
 return chartMarkup(name,rows,key,{unit,color,percent:key==="soc",zero:key==="power_w"||key==="heater_w",
  threshold:key==="soc"?lastMission?.reserve_percent:key==="rf_margin_db"?lastMission?.rf_required_margin_db:null});
}
function plotMeasured(samples,key,color){
 return chartMarkup("Diviner archival temperature",samples,key,{unit:"°C",color,kind:"observed"});
}
function timeRibbon(title,samples,key){
 const first=Date.parse(samples[0]?.time),last=Date.parse(samples.at(-1)?.time);
 if(!Number.isFinite(first)||!Number.isFinite(last)||last<=first)return '<div class="chart"><p class="muted">Insufficient timeline data</p></div>';
 // Run-length encoding retains every computed visibility transition. The old
 // 180-cell sampling lost short events and could misrepresent blackout lengths.
 const intervals=[];
 for(let i=0;i<samples.length-1;i++){
  const from=Date.parse(samples[i].time),to=Date.parse(samples[i+1].time);
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)continue;
  const active=!!samples[i][key],prior=intervals.at(-1);
  if(prior&&prior.active===active&&prior.end===from)prior.end=to;
  else intervals.push({from,end:to,active});
 }
 const marks=utcTicks(first,last,5);
 const ribbons=intervals.map(v=>{
  const percent=(v.end-v.from)/(last-first)*100;
  const color=v.active?(key==="power_conservation_advisory"?"#dba748":"#32a994"):"#dbe2e8";
  return '<span role="img" aria-label="'+(v.active?"Active":"Inactive")+' '+escapeHtml(key)+
   '" title="'+escapeHtml(new Date(v.from).toISOString()+" to "+new Date(v.end).toISOString())+
   '" style="flex:0 0 '+percent.toFixed(6)+'%;background:'+color+'"></span>';
 }).join("");
 return '<div class="chart ribbon-chart"><div class="chart-head"><strong>'+escapeHtml(title)+'</strong><span>UTC</span></div>'+
  '<div class="windows">'+ribbons+'</div>'+
  '<div class="ribbon-ticks">'+marks.map(x=>'<span>'+escapeHtml(x.label)+'</span>').join("")+'</div></div>';
}
function windows(samples){
 return chartMarkup("Earth terrain clearance",samples,"earth_clearance_deg",
  {unit:"°",color:"#6bb8e8",threshold:0,highlightAbove:true});
}
const CHART_EXPLANATIONS={
 power:["Solar generation","Estimated array production from Sun elevation, panel orientation and assumed conversion efficiency.","At the lunar poles, shallow sunlight and ridges can interrupt charging. Read watts (vertical) versus UTC (horizontal); zero means no generation."],
 battery:["Battery charge","Projected remaining charge as a percentage of battery capacity.","Long darkness can exhaust reserves. Compare to the horizontal reserve threshold; the curve assumes a specified battery and electrical load."],
 regolith:["Regolith temperature","Modeled ground radiative temperature; not the temperature of the spacecraft.","Extreme temperature shifts create thermal design challenges. Read °C over UTC; this is not a direct measurement."],
 lander:["Spacecraft temperature","A one-node thermal model using assumed heat capacity, radiator and heater.","Electronics have operating limits. Read the projected °C and compare with the craft's assumed tolerance; not flight-validated."],
 heater:["Heater electrical demand","Modeled heater power needed to meet the chosen thermal setpoint.","Heaters drain batteries in shadowed periods. Read watts over UTC alongside battery charge."],
 radio:["S-band radio margin","Estimated received link margin from Earth range and hypothetical antennas, transmitter and bitrate.","Earth can be visible but communications can still fail. Higher dB margin improves this assumed budget; ground-station scheduling is excluded."],
 diviner:["Diviner historical temperatures","NASA LRO Diviner measurements binned by lunar local time, shown as separate observations.","Historical context helps estimate thermal uncertainties. Dots are archived bins, not an uninterrupted forecast for this mission date."],
 earth:["Earth terrain clearance","Earth-center angular elevation minus the modeled local terrain horizon.","Green above 0° indicates geometric direct-to-Earth line of sight; gray at or below 0° means blocked. Antenna pointing, RF signal strength and ground-station availability can still prevent contact."]
};
function metricSlot(index,key,content){
 const note=CHART_EXPLANATIONS[key];
 const info='<details class="chart-information"><summary aria-label="Explain '+escapeHtml(key)+' graph" title="About this graph">'+
  '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" focusable="false">'+
  '<circle cx="10" cy="10" r="8.1" fill="none" stroke="currentColor" stroke-width="1.55"/>'+
  '<circle cx="10" cy="5.8" r="1" fill="currentColor"/>'+
  '<path d="M10 9v5.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.7"/></svg>'+
  '</summary><div class="chart-info-content"><strong>'+escapeHtml(note[0])+'</strong>'+
  '<p>'+escapeHtml(note[1])+'</p><p>'+escapeHtml(note[2])+'</p></div></details>';
 // Keep the info WITHIN the science plot so fullscreen preserves it.
 const expand='<button type="button" class="plot-expand"';
 if(content.includes(expand))content=content.replace(expand,info+expand);
 else content=content.replace(/(<div class="chart[^"]*"[^>]*>)/, '$1'+info);
 return '<div class="metric-slot metric-'+key+'" data-metric="'+key+'">'+content+'</div>';
}
// Exact, shared graph strokes by visual column. The left column has one
// navy shade; the right has one sky-blue shade for every scenario.
export const SCIENCE_GRAPH_PALETTE=Object.freeze({left:"#184a78",right:"#6bb8e8"});
function card(data,label){
 const m=data.metrics,s=data.samples;
 const rows=[
  metricSlot(1,"power",chart("Solar generation",s,"power_w",SCIENCE_GRAPH_PALETTE.left)),
  metricSlot(2,"battery",chart("Battery charge",s,"soc",SCIENCE_GRAPH_PALETTE.right,100)),
  metricSlot(3,"regolith",chart("Regolith temperature",s,"temperature_proxy_c",SCIENCE_GRAPH_PALETTE.left)),
  metricSlot(4,"lander",chart("Lander thermal model",s,"lander_temperature_c",SCIENCE_GRAPH_PALETTE.right)),
  metricSlot(5,"heater",chart("Heater power",s,"heater_w",SCIENCE_GRAPH_PALETTE.left)),
  metricSlot(6,"radio",m.predicted_rf_link_hours!==null?
   chart("S-band RF margin",s,"rf_margin_db",SCIENCE_GRAPH_PALETTE.right):
   '<div class="chart chart-unavailable"><div class="chart-title">S-band RF margin</div><p class="muted">RF model unavailable. Geometric Earth visibility remains shown.</p></div>'),
  metricSlot(7,"diviner",s.some(x=>Number.isFinite(x.diviner_observed_c))?
   plotMeasured(s,"diviner_observed_c",SCIENCE_GRAPH_PALETTE.left):
   '<div class="chart chart-unavailable"><div class="chart-title">Diviner reference (historical)</div><p class="muted">'+escapeHtml(data.quality?.diviner_observations||"No matching archival observations")+'</p></div>'),
  metricSlot(8,"earth",windows(s))
 ];
 return '<article class="card scenario-card">'+
  '<header class="scenario-header"><small>'+escapeHtml(label)+'</small><h2>'+
   data.site.latitude.toFixed(3)+'°, '+data.site.longitude.toFixed(3)+'°</h2>'+
   '<p class="muted">Landing '+escapeHtml(data.landing_time)+' · '+data.duration_days+'-day mission</p></header>'+
  '<div class="stats">'+[['Solar energy',m.total_energy_wh.toLocaleString()+' Wh'],['Earth visibility',(100*m.earth_fraction).toFixed(0)+'%'],['Longest blackout',m.max_earth_blackout_h+' h'],['Minimum battery',m.min_soc+'%']].map(([k,v])=>
    '<div class="stat"><small>'+k+'</small><b>'+v+'</b></div>').join("")+'</div>'+
  '<div class="scenario-plot-grid" aria-label="Eight synchronized mission science charts">'+rows.join("")+'</div>'+
  '<details class="scenario-more"><summary>Additional operational timelines</summary>'+
   timeRibbon("Power-conservation advisory · amber = advisory",s,"power_conservation_advisory")+
   (m.predicted_rf_link_hours!==null?timeRibbon("Modeled RF link availability · assumed margin",s,"rf_link_available"):"")+
  '</details>'+
  '<div class="science-card-summary"><span>NASA-derived data · Engineering projections</span>'+
  '<button type="button" data-info-open class="science-card-info">ⓘ Methods &amp; limitations</button></div>'+
  '<section class="terrain-panel" data-site-lat="'+data.site.latitude+'" data-site-lon="'+data.site.longitude+'">'+
  '<div class="terrain-heading"><h3>3D local lunar terrain</h3><small>NASA LOLA DEM · drag to rotate · scroll to zoom</small></div>'+
  '<p class="muted">Loading elevation grid...</p></section></article>';
}
let scienceInfoReturnFocus=null;
function openScienceInformation(){
 const panel=$("scienceInfoDrawer"),overlay=$("scienceInfoOverlay");
 if(!panel)return;
 scienceInfoReturnFocus=document.activeElement;
 overlay.hidden=false;panel.hidden=false;
 $("scienceInfoOpen").setAttribute("aria-expanded","true");
 $("scienceInfoClose").focus();
}
function closeScienceInformation(){
 const panel=$("scienceInfoDrawer"),overlay=$("scienceInfoOverlay");
 if(!panel||panel.hidden)return;
 panel.hidden=true;overlay.hidden=true;
 $("scienceInfoOpen").setAttribute("aria-expanded","false");
 const back=scienceInfoReturnFocus?.isConnected?scienceInfoReturnFocus:$("scienceInfoOpen");
 if(typeof back?.focus==="function")back.focus();
 scienceInfoReturnFocus=null;
}
function setupScienceInformation(){
 const page=$("resultsPage"),back=$("back");
 const trigger=document.createElement("button");
 trigger.type="button";trigger.id="scienceInfoOpen";trigger.className="science-info-trigger";
 trigger.setAttribute("aria-haspopup","dialog");trigger.setAttribute("aria-controls","scienceInfoDrawer");
 trigger.setAttribute("aria-expanded","false");
 trigger.textContent="ⓘ Information";
 back.parentNode.insertBefore(trigger,back);
 const overlay=document.createElement("div");
 overlay.id="scienceInfoOverlay";overlay.className="science-info-overlay";overlay.hidden=true;
 const panel=document.createElement("aside");
 panel.id="scienceInfoDrawer";panel.className="science-info-drawer";panel.hidden=true;
 panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");
 panel.setAttribute("aria-labelledby","scienceInfoTitle");
 panel.innerHTML='<header class="science-info-header"><div><small>SIMULATION REFERENCE</small><h2 id="scienceInfoTitle">Information &amp; sources</h2><p>Data provenance, engineering assumptions and limitations</p></div><button id="scienceInfoClose" type="button" aria-label="Close information panel">✕</button></header><div id="scienceInfoBody" class="science-info-body"></div>';
 const edge=document.createElement("button");
 edge.type="button";edge.id="scienceInfoEdge";edge.className="science-info-edge";
 edge.setAttribute("aria-label","Open simulation information and sources");
 edge.textContent="ⓘ Information";
 page.append(edge,overlay,panel);
 edge.addEventListener("click",openScienceInformation);
 trigger.addEventListener("click",openScienceInformation);
 $("scienceInfoClose").addEventListener("click",closeScienceInformation);
 overlay.addEventListener("click",closeScienceInformation);
 $("results").addEventListener("click",event=>{
  if(event.target.closest("[data-info-open]"))openScienceInformation();
 });
 document.addEventListener("keydown",event=>{
  if(panel.hidden)return;
  if(event.key==="Escape"){event.preventDefault();closeScienceInformation();return;}
  if(event.key==="Tab"){
   const focusable=[...panel.querySelectorAll('button:not([disabled]),a[href],input,select,textarea')].filter(el=>!el.hidden);
   if(!focusable.length)return;
   const first=focusable[0],last=focusable.at(-1);
   if(event.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){
    event.preventDefault();last.focus();
   }else if(!event.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){
    event.preventDefault();first.focus();
   }
  }
 });
}
setupScienceInformation();
function render(){
 resetCharts();
 let html=lastResult?
  '<div class="science-overview"><span class="science-overview-tag">NASA data · engineering models</span><button type="button" data-info-open class="science-overview-link">Methods &amp; sources</button></div>':"";
 if(comparison){
  const variants=[
   {id:"original",label:"Original selection",data:comparison.original},
   {id:"date-fixed",label:"Date fixed · optimize site",data:comparison.dateFixed},
   {id:"site-fixed",label:"Site fixed · optimize date",data:comparison.siteFixed}
  ];
  html+='<div class="scenario-triple-viewport"><div class="cards scenario-triple">'+
   variants.map(item=>item.data?'<div data-scenario-card="'+item.id+'">'+card(item.data,item.label)+'</div>':
    '<div class="scenario-empty">No candidate found for '+escapeHtml(item.label)+'</div>').join("")+
   '</div></div>';
 }else if(lastResult)html+='<div class="cards scenario-single">'+card(lastResult,"Original selection")+'</div>';
 window.lunaLaunchScenarios = [
  {id:"original",label:"Original mission",data:comparison?.original||lastResult},
  ...(comparison?[
   {id:"date-fixed",label:"Date fixed optimization",data:comparison.dateFixed},
   {id:"site-fixed",label:"Site fixed optimization",data:comparison.siteFixed}
  ]:[])
 ].filter(item=>item.data).map(item=>({
  id:item.id,label:item.label,arrival_time:item.data.landing_time,
  latitude:item.data.site?.latitude,longitude:item.data.site?.longitude
 }));
 $("results").innerHTML=html;
 window.dispatchEvent(new CustomEvent("luna:scenarios-updated",{detail:window.lunaLaunchScenarios}));
 $("scienceInfoBody").innerHTML=renderScientificInformation(lastResult,comparison);
 attachChartInteractions($("results"));
}

let terrainInstances=[];
async function mountTerrainViews(){
 terrainInstances.forEach(x=>x.dispose());terrainInstances=[];
 const places=[...$("results").querySelectorAll(".terrain-panel")];
 if(!places.length)return;
 const globeDEM=await loadLolaGlobal().catch(()=>null);
 for(const node of places){
  if(!node.isConnected)continue;
  const latitude=Number(node.dataset.siteLat),longitude=Number(node.dataset.siteLon);
  const patch=await loadPolarPatch(latitude,longitude).catch(()=>null);
  if(!node.isConnected)continue;
  terrainInstances.push(initTerrain3D(node,{latitude,longitude,patch,global:globeDEM}));
 }
}
function busy(button,fn){button.disabled=true;const old=button.textContent;button.textContent="Calculating…";Promise.resolve().then(fn).catch(e=>alertUser(e.message)).finally(()=>{button.disabled=false;button.textContent=old})}
$("simulate").addEventListener("click",()=>busy($("simulate"),async()=>{const req=mission(),r=await api("simulate",req);lastMission=req;lastResult=r;comparison=null;$("optimize").disabled=false;render();showResults();await mountTerrainViews();}));
$("optimize").addEventListener("click",()=>{if(!lastMission)return;
 busy($("optimize"),async()=>{
  const [fixedDate,fixedSite]=await Promise.all([
   api("optimize",{mission:lastMission,preserve:"time"}),
   api("optimize",{mission:lastMission,preserve:"site"})
  ]);
  comparison={original:lastResult,dateFixed:fixedDate.recommended,siteFixed:fixedSite.recommended,
   variants:[fixedDate,fixedSite],
   search:"Date-fixed site search and location-fixed date search run independently.",
   comparison_note:"Candidates are screened against model assumptions, not landing safety requirements."};
  render();showResults();await mountTerrainViews();
 });
});
$("restartMission").addEventListener("click",()=>{
 closeScienceInformation();
 for(const element of document.querySelectorAll("#missionFields input,#missionFields select")){
  if(element.tagName==="SELECT"){
   const option=[...element.options].find(o=>o.defaultSelected)||element.options[0];
   if(option)element.value=option.value;
  }else element.value=element.defaultValue;
 }
 for(const disclosure of document.querySelectorAll("#missionFields details"))disclosure.open=false;
 position={latitude:-89.5,longitude:0};globe.reset?.();moonSky3D.reset();showCoords();
 lastMission=null;lastResult=null;comparison=null;$("optimize").disabled=true;
 terrainInstances.forEach(x=>x.dispose());terrainInstances=[];
 $("results").replaceChildren();window.lunaLaunchScenarios=[];
 window.dispatchEvent(new CustomEvent("luna:scenarios-updated",{detail:[]}));
 $("timeLabel").textContent=formatPlaybackUtc(Number($("time").value));
 showGlobe();refreshPreview();
});
$("back").addEventListener("click",showGlobe);
$("time").addEventListener("input",()=>{$("timeLabel").textContent=formatPlaybackUtc(Number($("time").value));setChartsCursor($("results"),mission().landing_time);refreshPreview();});
$("date").addEventListener("change",()=>refreshPreview());
// Always-visible circular up-arrow: scroll the mobile document and desktop
// results/sidebar independently. Respect reduced-motion preferences.
$("scrollToTop")?.addEventListener("click",()=>{
 const behavior=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  ?"auto":"smooth";
 const goTop=element=>{
  if(!element)return;
  if(typeof element.scrollTo==="function")element.scrollTo({top:0,behavior});
  else element.scrollTop=0;
 };
 goTop(document.scrollingElement);
 goTop($("resultsPage"));
 goTop($("missionFields"));
 window.scrollTo({top:0,behavior});
});
showCoords();refreshPreview();

