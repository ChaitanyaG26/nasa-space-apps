/* LUNA Earth-to-Moon launch-window teaching model.
 * Not an official Launch COLA screening, range clearance, or flight trajectory.
 * NASA LSP launch range references: nasa.gov/kennedy/launch-services-program/launch-services-program-launch-sites/
 * NASA sounding ranges: nasa.gov/soundingrockets/launch-locations/
 * NASA/FAA/US Space Force launch COLA requires authoritative space-object and flight-path data.
 */
const DEG=Math.PI/180, DAY=86400000, MU=398600.4418, R_EARTH=6378.137;
// Representative sites named by NASA LSP and Sounding Rocket Program; not a roster of approved translunar launchpads.
const LAUNCH_SITES=[
 {id:"ksc",name:"Kennedy Space Center · LC-39",lat:28.627,lon:-80.621,category:"NASA orbital",note:"NASA launch complex; actual pad/vehicle capability must be confirmed"},
 {id:"ccsfs",name:"Cape Canaveral Space Force Station",lat:28.563,lon:-80.577,category:"NASA-used orbital",note:"US Space Force range; NASA launches occur via commercial providers"},
 {id:"vandenberg",name:"Vandenberg Space Force Base",lat:34.633,lon:-120.611,category:"NASA-used orbital",note:"US Space Force range; vehicle and departure-corridor limitations not modeled"},
 {id:"wallops",name:"Wallops Flight Facility / MARS",lat:37.833,lon:-75.489,category:"NASA orbital/suborbital",note:"NASA range; MARS is state-operated; vehicle capability must be verified"},
 {id:"kwaj",name:"Reagan Test Site · Kwajalein",lat:8.72,lon:167.73,category:"NASA-used historic/mission-specific",note:"Mission-dependent range; not a general bookable lunar launchpad"},
 {id:"mahia",name:"Māhia · Rocket Lab LC-1",lat:-39.262,lon:177.865,category:"NASA-used commercial",note:"Provider capability and orbital mission applicability must be verified"},
 {id:"starbase",name:"Starbase · Boca Chica",lat:25.996,lon:-97.155,category:"NASA-used commercial",note:"Vehicle-specific operational and licensing requirements not modeled"},
 {id:"kodiak",name:"Pacific Spaceport Complex · Alaska",lat:57.435,lon:-152.339,category:"Potential NASA launch-provider range",note:"Provider-specific; no NASA lunar launch capability asserted"},
 {id:"poker",name:"Poker Flat Research Range",lat:65.129,lon:-147.471,category:"NASA sounding rocket",note:"Suborbital science range; not an established translunar launch facility"},
 {id:"whitesands",name:"White Sands Missile Range",lat:32.99,lon:-106.97,category:"NASA sounding rocket",note:"Suborbital science range; not an established translunar launch facility"},
 {id:"svalbard",name:"Svalbard Rocket Range · Norway",lat:78.926,lon:11.93,category:"NASA sounding rocket",note:"Research range; not a translunar launch facility"},
 {id:"barking",name:"Pacific Missile Range Facility · Hawaii",lat:21.977,lon:-159.747,category:"NASA sounding rocket",note:"Research range; not a translunar launch facility"},
 {id:"andoya",name:"Andøya Space Center · Norway",lat:69.294,lon:16.02,category:"NASA sounding rocket",note:"International research range; not a demonstrated lunar launch site"},
 {id:"arnhem",name:"Arnhem Space Centre · Australia",lat:-12.28,lon:136.84,category:"NASA sounding rocket",note:"International sounding-rocket range; not a translunar launchpad"}
];
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
function goal(){
 const date=document.getElementById("date")?.value||"2026-11-20";
 const ten=Number(document.getElementById("time")?.value??72);
 const time=new Date(date+"T00:00:00Z").getTime()+ten*600000;
 const coords=document.querySelector("#results .card h2")?.textContent||"";
 return {time,coords:coords||document.getElementById("coords")?.textContent||"Selected Moon site"};
}
let persisted={site:"ksc",parking:200,span:24,step:60,holds:""};
function installPanel(){
 const parent=document.getElementById("results");if(!parent||!parent.children.length||parent.querySelector("#luna-launch-cola"))return;
 const el=document.createElement("section");el.className="launch-cola";el.id="luna-launch-cola";
 el.innerHTML=`<div class="launch-cola-head"><div><small>EARTH TO MOON · OPTIONAL MISSION EXTENSION</small><h2>Launch Window &amp; COLA</h2><p>Preliminary orbital transfer geometry below your lunar mission graphs. <b>Not an official collision-avoidance result.</b></p></div><span class="launch-cola-tag">EDUCATIONAL MODEL</span></div>
 <div class="launch-cola-form">
 <label>NASA / NASA-used launch range<select id="cola-site">${LAUNCH_SITES.map(s=>`<option value="${s.id}">${htmlSafe(s.name)}</option>`).join("")}</select></label>
 <label>LEO parking altitude (km)<input id="cola-parking" type="number" min="160" max="2000" step="20" value="200"></label>
 <label>Search ± hours from transfer target<select id="cola-span"><option value="12">12 h</option><option value="24">24 h</option><option value="48">48 h</option><option value="72">72 h</option></select></label>
 <label>Time step<select id="cola-step"><option value="30">30 min</option><option value="60">60 min</option><option value="120">120 min</option></select></label></div>
 <p class="launch-cola-site-note" id="cola-site-note"></p>
 <details class="launch-cola-holds"><summary>Optional official COLA hold intervals (manual UTC input)</summary><p>Paste externally issued launch hold intervals as start,end UTC timestamps, one per line. The app does not request authoritative conjunction data. Blank means <b>not screened</b>, not “all clear.”</p><textarea id="cola-holds" rows="3" placeholder="2026-11-15T12:00Z,2026-11-15T12:40Z"></textarea></details>
 <button id="cola-calc" class="launch-cola-run" type="button">Evaluate preliminary launch windows</button>
 <div id="cola-output" aria-live="polite"></div>
 <div class="launch-cola-animation"><b>Launch animation (coming later)</b><p>Reserved for a Higgsfield-rendered launch clip. No animation service is currently connected, and this placeholder does not visualize a calculated flight path.</p></div>
 <div class="launch-cola-provenance"><b>Scope:</b> Approximate geocentric Moon position from truncated lunar theory; idealized Earth-centered two-body Hohmann transfer from circular LEO to lunar orbital radius. Times are candidate <i>screening hypotheses</i>, not optimized flight paths. Does not model ascent corridors, staging, atmospheric flight, inclination/RAAN targeting, finite-burn TLI, lunar orbit insertion, landing-site access, weather, licensing, satellite conjunctions, space debris, ISS, spacecraft covariance or range hold approvals. <b>Never interpret “outside provided holds” as cleared for launch.</b><p>NASA sources: <a href="https://www.nasa.gov/kennedy/launch-services-program/launch-services-program-launch-sites/" target="_blank" rel="noopener">Launch Services Program ranges</a> · <a href="https://www.nasa.gov/soundingrockets/launch-locations/" target="_blank" rel="noopener">Sounding rocket ranges</a> · <a href="https://www.nasa.gov/cara/" target="_blank" rel="noopener">NASA conjunction assessment</a> · <a href="https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_450.169-1.pdf" target="_blank" rel="noopener">FAA launch COLA guidance</a>.</p></div>`;
 parent.appendChild(el);
 ["site","parking","span","step"].forEach(k=>{const field=el.querySelector("#cola-"+k);field.value=persisted[k];field.addEventListener("change",()=>{persisted[k]=field.value;});});
 el.querySelector("#cola-holds").value=persisted.holds;
 el.querySelector("#cola-holds").addEventListener("input",e=>{persisted.holds=e.target.value;});
 el.querySelector("#cola-calc").addEventListener("click",()=>runPanel(el));
 renderSiteNote(el);
 el.querySelector("#cola-site").addEventListener("change",()=>renderSiteNote(el));
}
function renderSiteNote(el){
 const s=LAUNCH_SITES.find(s=>s.id===el.querySelector("#cola-site").value)||LAUNCH_SITES[0];
 el.querySelector("#cola-site-note").textContent=s.category+" · "+s.lat.toFixed(3)+"°, "+s.lon.toFixed(3)+"° · "+s.note;
}
function runPanel(el){
 const output=el.querySelector("#cola-output");
 const site=LAUNCH_SITES.find(s=>s.id===el.querySelector("#cola-site").value);
 const parking=Number(el.querySelector("#cola-parking").value);
 const scanHours=Number(el.querySelector("#cola-span").value);
 const stepMin=Number(el.querySelector("#cola-step").value);
 const {time,coords}=goal(),parsed=parseHolds(el.querySelector("#cola-holds").value);
 if(!site||!Number.isFinite(time)||!Number.isFinite(parking)||parking<160||parking>2000||parsed.errors.length){
  output.innerHTML='<p class="launch-cola-error">'+htmlSafe(parsed.errors.join("; ")||"Invalid launch configuration")+'</p>';return;
 }
 const candidates=searchWindows(site,time,parking,scanHours,stepMin,parsed.intervals);
 const shown=candidates.filter(c=>!c.held).slice(0,5);
 const heldCount=candidates.filter(c=>c.held).length;
 const best=shown[0],base=candidates[0];
 const transfer=base?.flightDays||0;
 const missing=parsed.intervals.length===0;
 output.innerHTML=`<div class="launch-cola-summary">
 <div><small>LUNAR DESTINATION</small><b>${htmlSafe(coords)}</b><span>Requested lunar arrival: ${htmlSafe(utc(time))}</span></div>
 <div><small>IDEALIZED TRANSFER</small><b>${transfer.toFixed(2)} days</b><span>Circular LEO → lunar radius, two-body approximation</span></div>
 <div><small>ESTIMATED TLI ΔV</small><b>${(base?.tli??0).toFixed(2)} km/s</b><span>Impulsive burn above circular LEO speed; ascent excluded</span></div>
 <div><small>COLA STATUS</small><b>NOT CLEARED</b><span>${missing?"No authority hold intervals supplied":heldCount+" sample times overlap entered holds; outside holds ≠ approval"}</span></div>
 </div>
 <div class="launch-cola-route" role="img" aria-label="Schematic Hohmann transfer from Earth to lunar orbital distance; not to scale"><svg viewBox="0 0 680 130"><circle cx="77" cy="69" r="24" fill="#527da6"/><circle cx="591" cy="69" r="14" fill="#afb8c5"/><path d="M100 75 Q300 -54 577 65" stroke="#3d958e" stroke-width="3" fill="none" stroke-dasharray="8 5"/><path d="M100 75 L111 69" stroke="#3d958e" stroke-width="3"/><text x="55" y="114" font-size="12" fill="#26465e">Earth</text><text x="572" y="114" font-size="12" fill="#26465e">Moon</text><text x="246" y="27" font-size="12" fill="#315d64">Idealized transfer arc · NOT TO SCALE</text></svg></div>
 <h3>Candidate departure times (UTC) — geometry heuristic only</h3>
 ${shown.length?`<div class="launch-cola-table"><table><thead><tr><th>Departure UTC</th><th>Arrival offset</th><th>Target bearing proxy</th><th>COLA clearance</th></tr></thead><tbody>${shown.map(c=>`<tr><td>${htmlSafe(utc(c.launch))}</td><td>${c.timingHours>=0?"+":""}${c.timingHours.toFixed(1)} h</td><td>${c.geometry.az.toFixed(0)}° az / ${c.geometry.el.toFixed(0)}° el</td><td>NOT VERIFIED</td></tr>`).join("")}</tbody></table></div>`:'<p class="launch-cola-error">All sampled times overlap the manually entered hold intervals. Extend the search or use a verified updated window.</p>'}
 <p class="launch-cola-warning">These are <b>illustrative arrival-timing / Moon-bearing candidates</b>, NOT NASA-approved optimal launch windows or collision-free trajectories. Launch site coordinates are approximate range locations; some listed ranges are sounding-rocket-only. A real mission requires vehicle performance, flight-path constraints, full ephemeris/Lambert targeting, and official COLA screening.</p>`;
}
if(typeof document!=="undefined"){
 const attach=()=>{const root=document.getElementById("results");if(!root)return;const watch=new MutationObserver(installPanel);watch.observe(root,{childList:true});installPanel();};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",attach,{once:true});else attach();
}
export {LAUNCH_SITES,moonPosition,moonBearing,transferEstimate,parseHolds,searchWindows};
