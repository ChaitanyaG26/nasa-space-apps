import {initGlobe} from "./globe.js";
import {staticApi,simulateWithGeometry,optimizeWithEngine} from "./static-engine.mjs";
import {loadJplReference,referencePreview,geometrySeries} from "./horizons-static.mjs?v=20261114b";
import {loadLolaGlobal,siteElevation,terrainHorizon} from "./lola-global.mjs";
import {THERMAL_PROVENANCE} from "./thermal-projection.mjs";
const IS_PAGES = window.LUNA_STATIC_SITE === true;
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
     const terrain=(req)=>siteElevation(lola,req.latitude,req.longitude);
     const horizon=(req)=>terrainHorizon(lola,req.latitude,req.longitude);
     const height=(req)=>terrain(req).elevation_km??0;
     if(path==="preview"){
       const p=referencePreview(reference,data,height(data));
       p.terrain=terrain(data);
       p.regional_horizon=horizon(data);
       return p;
     }
     if(path==="simulate"){
       return simulateWithGeometry(data,geometrySeries(reference,data,height(data)),
         "NASA/JPL Horizons Sun/Earth range + direction; Moon-center parallax geometry (not site-specific query)",terrain(data),horizon(data));
     }
     if(path==="optimize"){
       return optimizeWithEngine(data,req=>simulateWithGeometry(req,geometrySeries(reference,req,height(req)),
         "NASA/JPL Horizons Sun/Earth range + direction; Moon-center parallax geometry (not site-specific query)",terrain(req),horizon(req)));
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
function plot(samples,key,color,maxVal=null){if(!samples||samples.length<2)return "";const w=340,h=104,vals=samples.map(r=>Number(r[key]||0)),hi=maxVal??Math.max(...vals,1),lo=0;const coords=vals.map((v,i)=>(10+(w-20)*i/(vals.length-1)).toFixed(1)+","+(h-11-(h-23)*(v-lo)/Math.max(1,hi-lo)).toFixed(1)).join(" ");return '<svg viewBox="0 0 340 122" role="img" aria-label="'+key+' over time"><path d="M10 6 V105 H330" stroke="#c8d8e0" fill="none"/><polyline points="'+coords+'" stroke="'+color+'" fill="none" stroke-width="2"/>'+svgText(10,119,"Landing")+svgText(284,119,"Mission end", "#516976")+'</svg>'}
function chart(name,samples,key,color,maxVal){return '<div class="chart"><div class="chart-title">'+name+'</div>'+plot(samples,key,color,maxVal)+'</div>'}
function windows(samples){const ss=samples.filter((r,i)=>i%Math.max(1,Math.ceil(samples.length/140))===0);return '<div class="chart"><div class="chart-title">Geometric Earth visibility (teal = visible)</div><div class="windows">'+ss.map(s=>'<span style="flex:1;background:'+(s.earth_visible?"#4fbea6":"#c8d4df")+'"></span>').join("")+'</div></div>'}
function card(data,label){const m=data.metrics,s=data.samples;return '<div class="card"><small>'+escapeHtml(label)+'</small><h2>'+data.site.latitude.toFixed(3)+'°, '+data.site.longitude.toFixed(3)+'°</h2><div class="muted">Landing '+escapeHtml(data.landing_time)+' · '+data.duration_days+'-day mission</div><div class="stats">'+[['Solar energy',m.total_energy_wh.toLocaleString()+' Wh'],['Earth visibility',(100*m.earth_fraction).toFixed(0)+'%'],['Longest blackout',m.max_earth_blackout_h+' h'],['Minimum battery',m.min_soc+'%']].map(([k,v])=>'<div class="stat"><small>'+k+'</small><b>'+v+'</b></div>').join("")+'</div>'+chart("Generated solar power (W)",s,"power_w","#d39426")+chart("Battery state of charge (%)",s,"soc","#188d85",100)+chart("Projected regolith temperature (°C) · screening model",s,"temperature_proxy_c","#b46b6b")+
'<div class="chart"><div class="chart-title">Power conservation advisory (amber = threshold)</div><div class="windows">'+s.filter((r,i)=>i%Math.max(1,Math.ceil(s.length/140))===0).map(x=>'<span title="'+escapeHtml(x.time)+'" style="flex:1;background:'+(x.power_conservation_advisory?"#dfaa49":"#a5cfca")+'"></span>').join("")+'</div><p class="muted">Projected energy conservation only: SOC within 10 percentage points of reserve and solar power below load. NOT a command to hibernate or a thermal survival prediction.</p></div>'+windows(s)+
'<div class="note">PROJECTED regolith equilibrium using NASA Diviner observed range as context; albedo 0.12, emissivity 0.95, baseline 95 K; lacks thermal inertia, near-field heat exchange, and spacecraft thermal hardware. No site-specific Diviner lookup.</div>'+'<div class="note">'+(data.terrain?.coverage?('NASA LOLA measured regional elevation: '+data.terrain.elevation_km.toFixed(3)+' km; 8 px/degree (~3.8 km N–S). · '):'LOLA elevation unavailable. · ')+(data.regional_horizon?('Maximum COARSE regional obstruction: '+data.regional_horizon.max_obstruction_deg+'°. Local crater rims and near-field hazards are unresolved. · '):'Regional skyline unavailable. · ')+escapeHtml(data.quality.ephemeris)+' · <b>NASA references:</b> <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener noreferrer">JPL Horizons</a> · <a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noopener noreferrer">LOLA</a> · <a href="https://www.diviner.ucla.edu/science" target="_blank" rel="noopener noreferrer">Diviner thermal reference</a> · <a href="https://pds-geosciences.wustl.edu/missions/apollo/seismic.htm" target="_blank" rel="noopener noreferrer">Apollo seismic archive (not a local hazard forecast)</a> · <b>Projected engineering outputs, not mission-validated.</b> No rover traversal or seismic forecast.</div></div>'}
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
