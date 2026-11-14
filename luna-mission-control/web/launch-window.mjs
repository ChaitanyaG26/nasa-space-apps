import {mountOrbitAnimation,loadCatalogContext} from "./orbit-visualization.mjs";
/* LUNA Earth-to-Moon launch-window teaching model.
 * Not an official Launch COLA screening, range clearance, or flight trajectory.
 * NASA LSP launch range references: nasa.gov/kennedy/launch-services-program/launch-services-program-launch-sites/
 * NASA sounding ranges: nasa.gov/soundingrockets/launch-locations/
 * NASA/FAA/US Space Force launch COLA requires authoritative space-object and flight-path data.
 */
const DEG=Math.PI/180, DAY=86400000, MU=398600.4418, R_EARTH=6378.137;
// Three primary U.S. launch complexes selected for LUNA; not a roster of approved translunar launchpads.
const LAUNCH_SITES=[
 {id:"ksc",name:"Kennedy Space Center · LC-39",lat:28.627,lon:-80.621,category:"NASA orbital",note:"NASA launch complex; actual pad/vehicle capability must be confirmed"},
 {id:"ccsfs",name:"Cape Canaveral Space Force Station",lat:28.563,lon:-80.577,category:"NASA-used orbital",note:"US Space Force range; NASA launches occur via commercial providers"},
 {id:"vandenberg",name:"Vandenberg Space Force Base",lat:34.633,lon:-120.611,category:"NASA-used orbital",note:"US Space Force range; vehicle and departure-corridor limitations not modeled"}
]
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=v=>((v%360)+360)%360;
function moonPosition(utc){
 const d=(utc-Date.UTC(2000,0,1,12))/DAY, T=d/36525;
 const l=wrap(218.316+13.176396*d),m=wrap(134.963+13.064993*d)*DEG;
 const dd=wrap(297.850+12.190749*d)*DEG,f=wrap(93.272+13.229350*d)*DEG;
 const ms=wrap(357.529+0.98560028*d)*DEG;
 const lambda=(l+6.289*Math.sin(m)+1.274*Math.sin(2*dd-m)+.658*Math.sin(2*dd)+.214*Math.sin(2*m)-.186*Math.sin(ms)-.114*Math.sin(2*f))*DEG;
 const beta=(5.128*Math.sin(f)+.280*Math.sin(m+f)+.277*Math.sin(m-f)+.173*Math.sin(2*dd-f))*DEG;
 const eps=(23.439291-.0130042*T)*DEG;
 const x=Math.cos(beta)*Math.cos(lambda);
 const y=Math.cos(beta)*Math.sin(lambda)*Math.cos(eps)-Math.sin(beta)*Math.sin(eps);
 const z=Math.cos(beta)*Math.sin(lambda)*Math.sin(eps)+Math.sin(beta)*Math.cos(eps);
 return {ra:wrap(Math.atan2(y,x)/DEG),dec:Math.asin(clamp(z,-1,1))/DEG,
  distanceKm:385001-20905*Math.cos(m)-3699*Math.cos(2*dd-m)-2956*Math.cos(2*dd)};
}
function gmst(utc){const jd=utc/DAY+2440587.5, t=(jd-2451545)/36525;
 return wrap(280.46061837+360.98564736629*(jd-2451545)+.000387933*t*t-t*t*t/38710000);
}
function moonBearing(site,utc){
 const moon=moonPosition(utc),ha=(moon.ra-gmst(utc)-site.lon)*DEG,phi=site.lat*DEG,dec=moon.dec*DEG;
 const east=Math.cos(dec)*Math.sin(ha),north=Math.cos(phi)*Math.sin(dec)-Math.sin(phi)*Math.cos(dec)*Math.cos(ha);
 const up=Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(ha);
 return {moon,az:wrap(Math.atan2(east,north)/DEG),el:Math.asin(clamp(up,-1,1))/DEG};
}
function transferEstimate(site,utc,parkingKm){
 const moonAtArrival=moonPosition(utc+5*DAY);
 const r1=R_EARTH+parkingKm,r2=moonAtArrival.distanceKm,a=(r1+r2)/2;
 const flightDays=Math.PI*Math.sqrt(a*a*a/MU)/86400;
 const arrive=utc+flightDays*DAY,geometry=moonBearing(site,arrive);
 const circular=Math.sqrt(MU/r1),perigee=Math.sqrt(MU*(2/r1-1/a));
 const tli=Math.max(0,perigee-circular);
 // Geometry-based launch alignment is only a qualitative scheduling proxy.
 const alignment=Math.max(0,Math.cos(Math.min(90,Math.abs(geometry.el-45))*DEG));
 return {flightDays,tli,arrival:arrive,geometry,alignment};
}
function parseHolds(value){
 const intervals=[];const errors=[];
 value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).forEach((line,i)=>{
  const parts=line.split(",").map(s=>s.trim());
  const a=Date.parse(parts[0]||""),b=Date.parse(parts[1]||"");
  if(parts.length!==2||!Number.isFinite(a)||!Number.isFinite(b)||b<=a){errors.push("Line "+(i+1)+" must be: YYYY-MM-DDTHH:MMZ,YYYY-MM-DDTHH:MMZ");return;}
  intervals.push({a,b});
 });
 return {intervals,errors};
}
function searchWindows(site,arrivalGoal,parkingKm,scanHours,stepMin,holds){
 const nominal=transferEstimate(site,arrivalGoal-5*DAY,parkingKm);
 const center=arrivalGoal-nominal.flightDays*DAY;
 const output=[];
 for(let offset=-scanHours*60;offset<=scanHours*60;offset+=stepMin){
  const launch=center+offset*60000;
  const estimate=transferEstimate(site,launch,parkingKm);
  const timingHours=(estimate.arrival-arrivalGoal)/3600000;
  const held=holds.some(h=>launch>=h.a&&launch<h.b);
  // Pure heuristic. No ascent trajectory, range corridor, lunar orbit insertion, or COLA used.
  const penalty=Math.abs(timingHours)+4*(1-estimate.alignment);
  output.push({launch,...estimate,timingHours,held,penalty});
 }
 return output.sort((a,b)=>a.penalty-b.penalty);
}
function htmlSafe(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function utc(when){return new Date(when).toISOString().replace(".000Z","Z");}

const SCENARIOS=[
 {id:"original",label:"Original mission"},
 {id:"optimized",label:"Optimized alternative"}
];
const userState={
 original:{site:"ksc",holds:""},
 optimized:{site:"ksc",holds:""}
};
let controls={parking:200,span:24,step:60};
let orbitControllers=[];
function findScenarios(){
 const shared=globalThis.window?.lunaLaunchScenarios;
 if(Array.isArray(shared)&&shared.length)return shared.filter(s=>s?.data!==null);
 return [];
}
function scenarioTarget(s){
 const time=Date.parse(s?.arrival_time||"");
 const lat=Number(s?.latitude),lon=Number(s?.longitude);
 return Number.isFinite(time)&&Number.isFinite(lat)&&Number.isFinite(lon)
  ? {time,coords:lat.toFixed(3)+"°, "+lon.toFixed(3)+"°"}:null;
}
function scenarioMarkup(s){
 const state=userState[s.id]||userState.original;
 const target=scenarioTarget(s);
 return '<article class="launch-cola-scenario" data-cola-scenario="'+htmlSafe(s.id)+'">'+
  '<div class="launch-cola-scenario-head"><div><span class="launch-cola-eyebrow">'+htmlSafe(s.label)+'</span><h3>Launch window &amp; COLA screening</h3></div>'+
  '<span class="launch-cola-uncleared">NOT CLEARED</span></div>'+
  '<div class="launch-cola-target"><div><small>Lunar destination</small><strong>'+htmlSafe(target?.coords||"Unavailable")+'</strong></div>'+
  '<div><small>Requested arrival (UTC)</small><strong>'+htmlSafe(target?utc(target.time):"Unavailable")+'</strong></div></div>'+
  '<label class="launch-cola-field">Launch range<select data-cola-field="site">'+
    LAUNCH_SITES.map(site=>'<option value="'+site.id+'" '+(state.site===site.id?"selected":"")+'>'+htmlSafe(site.name)+'</option>').join("")+
  '</select></label>'+
  '<p class="launch-cola-site-note" data-cola-note></p>'+
  '<details class="launch-cola-holds"><summary>Optional official COLA hold intervals for this scenario</summary>'+
  '<p>Supply authorized hold intervals in UTC, one start,end pair per line. No entry means unscreened, not approved.</p>'+
  '<textarea data-cola-field="holds" rows="2" placeholder="2026-11-15T12:00Z,2026-11-15T12:40Z">'+htmlSafe(state.holds)+'</textarea></details>'+
  '<button class="launch-cola-run" data-cola-calc type="button">Evaluate '+htmlSafe(s.label.toLowerCase())+'</button>'+
  '<div data-cola-output aria-live="polite"><p class="launch-cola-hint">Run this scenario to see its own candidate departure times and clearance status.</p></div>'+
  '<div data-orbit-host></div>'+
 '</article>';
}
function installPanel(){
 const parent=document.getElementById("results");
 if(!parent||!parent.children.length||parent.querySelector("#luna-launch-cola"))return;
 const el=document.createElement("section");
 el.id="luna-launch-cola";el.className="launch-cola";
 el.innerHTML='<div class="launch-cola-head"><div><small>EARTH TO MOON · OPTIONAL MISSION EXTENSION</small>'+
  '<h2>Launch windows &amp; COLA</h2>'+
  '<p>Separate preliminary launch screens for the original and optimized lunar missions. <b>Not an official collision-avoidance assessment.</b></p></div>'+
  '<span class="launch-cola-tag">EDUCATIONAL MODEL</span></div>'+
  '<div class="launch-cola-form">'+
  '<label>LEO parking altitude (km)<input data-cola-shared="parking" type="number" min="160" max="2000" step="20" value="'+controls.parking+'"></label>'+
  '<label>Search ± hours<select data-cola-shared="span"><option value="12">12 h</option><option value="24">24 h</option><option value="48">48 h</option><option value="72">72 h</option></select></label>'+
  '<label>Time step<select data-cola-shared="step"><option value="30">30 min</option><option value="60">60 min</option><option value="120">120 min</option></select></label></div>'+
  '<div class="launch-cola-scenarios" data-cola-list></div>'+
  '<div class="launch-cola-animation"><b>Launch animations — reserved</b><p>Separate Higgsfield clips can be inserted for each mission later. The schematic is not a computed flight path.</p></div>'+
  '<details class="launch-cola-provenance"><summary>Methodology, scientific limits and sources</summary>'+
  '<p>Truncated lunar theory and idealized two-body Earth-to-lunar-radius transfer. The destination coordinates label the selected lunar surface site; the simplified transfer does not solve a surface landing or lunar orbit insertion. Ranking uses an arrival-timing and Moon-bearing heuristic, not operational launch trajectory optimization.</p>'+
  '<p>Real launch approval requires vehicle/range capabilities, trajectory targeting, tracked-object ephemerides, uncertainties and official COLA clearance. CelesTrak public OMM data is a partial, lower-fidelity reference and cannot validate a collision-free route. A time outside entered hold intervals is never declared safe.</p>'+
  '<p><a href="https://www.nasa.gov/kennedy/launch-services-program/launch-services-program-launch-sites/" target="_blank" rel="noopener noreferrer">NASA launch ranges</a> · <a href="https://www.nasa.gov/cara/" target="_blank" rel="noopener noreferrer">NASA conjunction assessment</a> · <a href="https://celestrak.org/NORAD/documentation/gp-data-formats.php" target="_blank" rel="noopener noreferrer">CelesTrak public catalog documentation</a> · <a href="https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_450.169-1.pdf" target="_blank" rel="noopener noreferrer">FAA COLA guidance</a></p></details>'+
  '<p class="launch-cola-scope-note"><b>Launch-site acknowledgement:</b> This educational model focuses on Cape Canaveral Space Force Station, Kennedy Space Center, and Vandenberg Space Force Base as major U.S. orbital launch locations. Many other NASA-associated ranges mainly support sounding rockets, small or specialized missions. This is not a complete list of orbital launch facilities.</p>';
 parent.appendChild(el);
 for(const field of el.querySelectorAll("[data-cola-shared]")){
  field.value=controls[field.dataset.colaShared];
  field.addEventListener("change",()=>{controls[field.dataset.colaShared]=field.value;});
 }
 renderScenarioPanels(el);
 el.addEventListener("change",e=>{
  const article=e.target.closest("[data-cola-scenario]");
  if(!article)return;
  const id=article.dataset.colaScenario;
  if(e.target.dataset.colaField==="site"){userState[id].site=e.target.value;renderSiteNote(article);}
 });
 el.addEventListener("input",e=>{
  const id=e.target.closest("[data-cola-scenario]")?.dataset.colaScenario;
  if(id&&e.target.dataset.colaField==="holds")userState[id].holds=e.target.value;
 });
 el.addEventListener("click",e=>{
  const article=e.target.closest("[data-cola-calc]")?.closest("[data-cola-scenario]");
  if(article)runScenario(article);
 });
}
function renderScenarioPanels(el){
 orbitControllers.forEach(c=>c.destroy());orbitControllers=[];
 const list=el.querySelector("[data-cola-list]");
 const scenarios=findScenarios();
 list.innerHTML=scenarios.map(s=>scenarioMarkup(s)).join("");
 for(const article of list.querySelectorAll("[data-cola-scenario]")){
  renderSiteNote(article);
  const controller=mountOrbitAnimation(article.querySelector("[data-orbit-host]"),{scenario:article.dataset.colaScenario});
  orbitControllers.push(controller);
  loadCatalogContext().then(data=>controller.setCatalog(data));
 }
}
function renderSiteNote(article){
 const id=article.dataset.colaScenario;
 const site=LAUNCH_SITES.find(s=>s.id===userState[id]?.site)||LAUNCH_SITES[0];
 article.querySelector("[data-cola-note]").textContent=
  site.category+" · "+site.lat.toFixed(3)+"°, "+site.lon.toFixed(3)+"° · "+site.note;
}
function resultMarkup(target,candidates,holds){
 const shown=candidates.filter(c=>!c.held).slice(0,5);
 const base=shown[0]||candidates[0];
 const heldCount=candidates.filter(c=>c.held).length;
 return '<div class="launch-cola-summary">'+
  '<div><small>IDEALIZED TRANSFER</small><b>'+base.flightDays.toFixed(2)+' days</b></div>'+
  '<div><small>ESTIMATED TLI ΔV</small><b>'+base.tli.toFixed(2)+' km/s</b></div>'+
  '<div><small>COLA CLEARANCE</small><b>NOT VERIFIED</b><span>'+(
   !holds.length?"No official holds supplied; not screened":
   heldCount+" sampled departures overlap supplied holds; all other times remain unverified")+'</span></div></div>'+
  '<h4>Candidate departure times · UTC</h4>'+
  (shown.length?'<div class="launch-cola-table"><table><thead><tr><th>Departure (UTC)</th><th>Arrival offset</th><th>Lunar bearing proxy</th><th>COLA</th></tr></thead><tbody>'+
   shown.map(c=>'<tr><td>'+htmlSafe(utc(c.launch))+'</td><td>'+
   (c.timingHours>=0?"+":"")+c.timingHours.toFixed(1)+' h</td><td>'+
   c.geometry.az.toFixed(0)+'° az / '+c.geometry.el.toFixed(0)+'° el</td><td>NOT VERIFIED</td></tr>').join("")+
   '</tbody></table></div>':'<p class="launch-cola-error">All sampled times overlap entered holds. Expand the scan or request new official data.</p>')+
  '<p class="launch-cola-warning">Educational timing hypotheses only. No launch time, flight trajectory, or COLA clearance is operationally validated.</p>';
}
function runScenario(article){
 const id=article.dataset.colaScenario;
 const scenario=findScenarios().find(s=>s.id===id);
 const target=scenarioTarget(scenario);
 const site=LAUNCH_SITES.find(s=>s.id===userState[id].site);
 const parking=Number(controls.parking),span=Number(controls.span),step=Number(controls.step);
 const holds=parseHolds(userState[id].holds);
 const output=article.querySelector("[data-cola-output]");
 if(!target||!site||!Number.isFinite(parking)||parking<160||parking>2000||
    ![12,24,48,72].includes(span)||![30,60,120].includes(step)||holds.errors.length){
  output.innerHTML='<p class="launch-cola-error">'+htmlSafe(holds.errors.join("; ")||"Invalid or incomplete scenario data.")+'</p>';
  return;
 }
 const candidates=searchWindows(site,target.time,parking,span,step,holds.intervals);
 output.innerHTML=resultMarkup(target,candidates,holds.intervals);
}
if(typeof document!=="undefined"){
 const attach=()=>{
  const root=document.getElementById("results");
  if(!root)return;
  const observer=new MutationObserver(installPanel);
  observer.observe(root,{childList:true});
  installPanel();
  window.addEventListener("luna:scenarios-updated",()=>{
   const panel=document.getElementById("luna-launch-cola");
   if(panel)renderScenarioPanels(panel);
  });
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",attach,{once:true});
 else attach();
}
export {LAUNCH_SITES,moonPosition,moonBearing,transferEstimate,parseHolds,searchWindows};
