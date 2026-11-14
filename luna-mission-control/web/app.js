import {initGlobe} from "./globe.js";
import {staticApi,simulateWithGeometry,optimizeWithEngine} from "./static-engine.mjs?v=20261114-lola20m-1";
import {loadJplReference,referencePreview,geometrySeries} from "./horizons-static.mjs?v=20261114b";
import {loadLolaGlobal,siteElevation,terrainHorizon} from "./lola-global.mjs";
import {loadPolarPatch,localPatchXY,samplePolarHeightKm,polarSiteSlopeDeg,refinePolarHorizon} from "./lola-polar-detail.mjs";
import {THERMAL_PROVENANCE} from "./thermal-projection.mjs";
import {loadDivinerAtLatitude,divinerObservedReference} from "./diviner-gcp.mjs";
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
function showCoords(){const lat=position.latitude,lon=position.longitude;const text=lat.toFixed(3)+"° "+(lat<0?"S":"N")+" · "+Math.abs(lon).toFixed(3)+"° "+(lon<0?"W":"E");$("coords").textContent=text;$("mapCoords").textContent=text}
function mission(){const minutes=Number($("time").value)*10;return {latitude:position.latitude,longitude:position.longitude,landing_time:$("date").value+"T"+String(Math.floor(minutes/60)).padStart(2,"0")+":"+String(minutes%60).padStart(2,"0")+":00Z",duration_days:Number($("duration").value),area_m2:Number($("area").value),panel_tilt_deg:Number($("tilt").value),panel_az_deg:Number($("az").value),battery_wh:Number($("battery").value),load_w:Number($("load").value),reserve_percent:Number($("reserve").value),data_mode:$("mode").value}}
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
 const cx=160,cy=55;
 const endpoint=(vec,radius)=>{
   const h=Math.hypot(vec.x,vec.z)||1;
   return [cx+radius*vec.x/h,cy-radius*vec.z/h];
 };
 const [sx,sy]=endpoint(fixed.sun,42),[ex,ey]=endpoint(fixed.earth,28);
 $("orbital").innerHTML=
   '<circle cx="160" cy="55" r="44" fill="none" stroke="#425f73" stroke-dasharray="3 5"/>'+
   '<line x1="160" y1="8" x2="160" y2="102" stroke="#304e60" stroke-dasharray="2 4"/>'+
   '<line x1="111" y1="55" x2="209" y2="55" stroke="#304e60" stroke-dasharray="2 4"/>'+
   '<line x1="160" y1="55" x2="'+sx+'" y2="'+sy+'" stroke="#f2c773" stroke-width="2"/>'+
   '<line x1="160" y1="55" x2="'+ex+'" y2="'+ey+'" stroke="#5acbff" stroke-width="2"/>'+
   '<circle cx="160" cy="55" r="11" fill="#738fa3" stroke="#afcad8"/>'+
   '<circle cx="'+sx+'" cy="'+sy+'" r="6" fill="#f3c56b"/>'+
   '<circle cx="'+ex+'" cy="'+ey+'" r="5" fill="#56b2df"/>'+
   svgText(12,15,"0°E ↑", "#90aabb")+
   svgText(251,15,"Top-down", "#90aabb")+
   svgText(15,104,"Moon-fixed", "#90aabb")+
   svgText(218,104,"Not to scale","#90aabb")+
   svgText(176,55,"Moon")+
   svgText(Math.min(265,sx+8),Math.max(11,Math.min(100,sy-4)),"Sun","#f3c56b")+
   svgText(Math.min(265,ex+7),Math.max(11,Math.min(100,ey+12)),"Earth","#56b2df");
 const hx=az=>20+280*(az%360)/360,hy=el=>88-Math.max(-25,Math.min(90,el))*.54;
 $("horizon").innerHTML='<line x1="12" y1="88" x2="308" y2="88" stroke="#83a5b8"/>'+
   svgText(12,103,"N")+svgText(87,103,"E")+svgText(159,103,"S")+
   svgText(232,103,"W")+svgText(296,103,"N")+
   '<circle cx="'+hx(p.sun_az)+'" cy="'+hy(p.sun_el)+'" r="7" fill="#ffc979"/>'+
   '<circle cx="'+hx(p.earth_az)+'" cy="'+hy(p.earth_el)+'" r="6" fill="#68caff"/>';
 $("angles").textContent="Sun "+p.sun_el.toFixed(1)+"° elevation · Earth "+p.earth_el.toFixed(1)+"° elevation"+
 (p.terrain?.coverage?" · LOLA elevation "+p.terrain.elevation_km.toFixed(3)+" km":"");
 $("source").textContent=p.source+" · "+p.global_source+(p.regional_horizon?.coverage?" · NASA LOLA coarse regional skyline":" · Regional horizon unavailable");
 globe.setSun(fixed.sun.x,fixed.sun.y,fixed.sun.z);
}
async function refreshPreview(){let id=++previewSeq;try{let p=await api("preview",mission());if(id===previewSeq)updateDiagrams(p)}catch(e){if(id===previewSeq){$("source").textContent="Preview unavailable: "+e.message; $("angles").textContent="No verified ephemeris for this selection";}}}
function showResults(){ $("mapPage").classList.add("hidden");$("resultsPage").classList.remove("hidden")}
function showGlobe(){ $("mapPage").classList.remove("hidden");$("resultsPage").classList.add("hidden")}
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function plot(samples,key,color,maxVal=null){if(!samples||samples.length<2)return "";const w=340,h=104,vals=samples.map(r=>Number(r[key])),finite=vals.filter(Number.isFinite);if(finite.length<2)return '<p class="muted">Projection unavailable for this selection</p>';const temp=key==="temperature_proxy_c";const lo=temp?Math.floor(Math.min(...finite)/10)*10:0,hi=maxVal??(temp?Math.ceil(Math.max(...finite)/10)*10:Math.max(...finite,1));const top=Math.max(lo+1,hi);const coords=vals.map((v,i)=>(10+(w-20)*i/(vals.length-1)).toFixed(1)+","+(h-11-(h-23)*(v-lo)/(top-lo)).toFixed(1)).join(" ");return '<svg viewBox="0 0 340 122" role="img" aria-label="'+key+' over time"><path d="M10 6 V105 H330" stroke="#c8d8e0" fill="none"/><polyline points="'+coords+'" stroke="'+color+'" fill="none" stroke-width="2"/>'+svgText(10,119,"Landing")+svgText(284,119,"Mission end","#516976")+svgText(15,14,top.toFixed(0)+(temp?" °C":""))+svgText(15,101,lo.toFixed(0)+(temp?" °C":""))+'</svg>'}
function plotMeasured(samples,key,color){
 const good=samples.map((v,i)=>({i,value:v[key]})).filter(x=>Number.isFinite(x.value));
 if(!good.length)return '<p class="muted">No measured NASA Diviner samples for this site and local times.</p>';
 const min=Math.min(...good.map(x=>x.value)),max=Math.max(...good.map(x=>x.value));
 const lo=Math.floor(min/10)*10,hi=Math.max(lo+1,Math.ceil(max/10)*10);
 const dots=good.map(({i,value})=>[10+320*i/(samples.length-1),93-81*(value-lo)/(hi-lo)]);
 return '<svg viewBox="0 0 340 122" role="img" aria-label="Historical measured Diviner temperature">'+
 '<path d="M10 6 V105 H330" stroke="#c8d8e0" fill="none"/>'+
 dots.map(([x,y])=>'<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="1.8" fill="'+color+'"/>').join("")+
 svgText(10,119,"Landing")+svgText(275,119,"Mission end")+
 svgText(10,14,hi+"°C")+svgText(10,101,lo+"°C")+'</svg>';
}
function chart(name,samples,key,color,maxVal){return '<div class="chart"><div class="chart-title">'+name+'</div>'+plot(samples,key,color,maxVal)+'</div>'}
function windows(samples){const ss=samples.filter((r,i)=>i%Math.max(1,Math.ceil(samples.length/140))===0);return '<div class="chart"><div class="chart-title">Geometric Earth visibility (teal = visible)</div><div class="windows">'+ss.map(s=>'<span style="flex:1;background:'+(s.earth_visible?"#4fbea6":"#c8d4df")+'"></span>').join("")+'</div></div>'}
function card(data,label){const m=data.metrics,s=data.samples;return '<div class="card"><small>'+escapeHtml(label)+'</small><h2>'+data.site.latitude.toFixed(3)+'°, '+data.site.longitude.toFixed(3)+'°</h2><div class="muted">Landing '+escapeHtml(data.landing_time)+' · '+data.duration_days+'-day mission</div><div class="stats">'+[['Solar energy',m.total_energy_wh.toLocaleString()+' Wh'],['Earth visibility',(100*m.earth_fraction).toFixed(0)+'%'],['Longest blackout',m.max_earth_blackout_h+' h'],['Minimum battery',m.min_soc+'%']].map(([k,v])=>'<div class="stat"><small>'+k+'</small><b>'+v+'</b></div>').join("")+'</div>'+chart("Generated solar power (W)",s,"power_w","#d39426")+chart("Battery state of charge (%)",s,"soc","#188d85",100)+chart("Projected regolith temperature (°C) · screening model",s,"temperature_proxy_c","#b46b6b")+
(s.some(x=>Number.isFinite(x.diviner_observed_c))?
 '<div class="chart"><div class="chart-title">NASA Diviner measured historic bolometric temperatures (°C) · 2009–2015 local-time bins</div>'+
 plotMeasured(s,"diviner_observed_c","#8052aa")+
 '<p class="muted">Historical observational reference at local lunar time, NOT a 2026 temperature observation or spacecraft measurement.</p></div>':
 '<div class="chart"><div class="chart-title">NASA Diviner historical reference</div><p class="muted">'+escapeHtml(data.quality.diviner_observations||"No archival observation loaded for this run")+'</p></div>')+
'<div class="chart"><div class="chart-title">Power conservation advisory (amber = threshold)</div><div class="windows">'+s.filter((r,i)=>i%Math.max(1,Math.ceil(s.length/140))===0).map(x=>'<span title="'+escapeHtml(x.time)+'" style="flex:1;background:'+(x.power_conservation_advisory?"#dfaa49":"#a5cfca")+'"></span>').join("")+'</div><p class="muted">Projected energy conservation only: SOC within 10 percentage points of reserve and solar power below load. NOT a command to hibernate or a thermal survival prediction.</p></div>'+windows(s)+
'<div class="note">PROJECTED regolith equilibrium using NASA Diviner observed range as context; albedo 0.12, emissivity 0.95, baseline 95 K; lacks thermal inertia, near-field heat exchange, and spacecraft thermal hardware. No site-specific Diviner lookup.</div>'+'<div class="note">'+(data.terrain?.coverage?('NASA LOLA measured regional elevation: '+data.terrain.elevation_km.toFixed(3)+' km; 8 px/degree (~3.8 km N–S). · '):'LOLA elevation unavailable. · ')+(data.regional_horizon?(
 'Maximum modeled skyline obstruction: '+data.regional_horizon.max_obstruction_deg+'°; '+
 (data.regional_horizon.near_field_resolved?
   'NASA LOLA 20m local detail to 3 km + coarse LOLA beyond; small hazards remain unresolved. · ':
   'COARSE regional LOLA only; nearby ridges and hazards may be unresolved. · ')
 ):'Regional skyline unavailable. · ')+
 (data.terrain?.detail_coverage?('Local 20m-DEM screening slope: '+
   (Number.isFinite(data.terrain.detail_slope_deg)?data.terrain.detail_slope_deg.toFixed(1)+'°':'unavailable')+
   ' — NOT certified rover traversability. · '):'')+escapeHtml(data.quality.ephemeris)+' · <b>Independent JPL site check:</b> '+escapeHtml(data.quality.horizons_direct_validation||"Unavailable")+' · <b>Diviner:</b> '+escapeHtml(data.quality.diviner_observations||"Historical reference not loaded")+
 (data.quality.thermal_model_mean_abs_error_c!==undefined&&data.quality.thermal_model_mean_abs_error_c!==null?
 ' · Mean absolute difference vs historical climatology: '+data.quality.thermal_model_mean_abs_error_c+' °C (NOT forecast validation)':'')+
 ' · <b>NASA references:</b> <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener noreferrer">JPL Horizons</a> · <a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noopener noreferrer">LOLA</a> · <a href="https://www.diviner.ucla.edu/science" target="_blank" rel="noopener noreferrer">Diviner thermal reference</a> · <a href="https://pds-geosciences.wustl.edu/missions/apollo/seismic.htm" target="_blank" rel="noopener noreferrer">Apollo seismic archive (not a local hazard forecast)</a> · <b>Projected engineering outputs, not mission-validated.</b> No rover traversal or seismic forecast.</div></div>'}
function render(){let html=lastResult?'<div class="quality">NASA DATA: JPL Horizons ephemeris and LOLA global elevation. PROJECTED: power, battery SOC, regolith temperature, Earth visibility, regional skyline, and power-conservation advisory. ASSUMED: hardware efficiency, panel area/tilt, load, battery, and thresholds. No site-calibrated Diviner temperature, link budget, rover hazards, seismic forecast, or certified landing assessment.</div>':'';if(comparison){html+='<div class="note">'+escapeHtml(comparison.search)+' · '+escapeHtml(comparison.comparison_note)+'</div><div class="cards">'+card(comparison.original,"ORIGINAL SELECTION")+(comparison.recommended?card(comparison.recommended,"RECOMMENDED ALTERNATIVE"):'<p>No alternative was produced.</p>')+'</div>'}else if(lastResult)html+='<div class="cards">'+card(lastResult,"ORIGINAL SELECTION")+'</div>'; $("results").innerHTML=html;}
function busy(button,fn){button.disabled=true;const old=button.textContent;button.textContent="Calculating…";Promise.resolve().then(fn).catch(e=>alertUser(e.message)).finally(()=>{button.disabled=false;button.textContent=old})}
$("simulate").addEventListener("click",()=>busy($("simulate"),async()=>{const req=mission(),r=await api("simulate",req);lastMission=req;lastResult=r;comparison=null;$("optimize").disabled=false;render();showResults();}));
$("optimize").addEventListener("click",()=>{if(!lastMission)return;busy($("optimize"),async()=>{comparison=await api("optimize",{mission:lastMission,preserve:$("preserve").value});render();showResults()})});
$("back").addEventListener("click",showGlobe);$("focus").addEventListener("click",()=>{globe.focus();position={latitude:-89.5,longitude:0};globe.setSite(position.latitude,position.longitude);showCoords();refreshPreview()});
$("time").addEventListener("input",()=>{let t=Number($("time").value)*10;$("timeLabel").textContent=String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0")+" UTC";refreshPreview()});
for(const id of ["date","mode"])$(id).addEventListener("change",refreshPreview);
showCoords();refreshPreview();
if(IS_PAGES){
 $("mode").value="horizons";
 $("mode").title="NASA/JPL observer azimuth, elevation, and range are generated by GitHub Actions. Browser computes Moon-centered body positions and corrects surface-site parallax; local terrain shadows are not yet modeled.";
 refreshPreview();
}
