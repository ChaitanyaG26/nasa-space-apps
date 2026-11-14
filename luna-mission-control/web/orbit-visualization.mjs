/* Public-catalog context + deliberately schematic transfer animation.
 * This is NOT SGP4 propagation, conjunction screening, or an avoidance solution.
 * CelesTrak GP (OMM JSON) is metadata only. Catalog update interval: about 2h.
 */
const CATALOG_URL="https://celestrak.org/NORAD/elements/gp.php?GROUP=STATIONS&FORMAT=JSON";
const CACHE_KEY="luna-stations-catalog-2026-v1";
const CACHE_MS=2*60*60*1000;
let catalogPromise;
const escapeHTML=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function normalizeCatalog(records){
 if(!Array.isArray(records))return [];
 return records.filter(r=>r&&typeof r.OBJECT_NAME==="string"&&
  Number.isFinite(Number(r.NORAD_CAT_ID))&&Number.isFinite(Date.parse(r.EPOCH)))
 .slice(0,8).map(r=>({name:r.OBJECT_NAME.slice(0,45),id:String(r.NORAD_CAT_ID),
  epoch:r.EPOCH,meanMotion:Number(r.MEAN_MOTION)||null}));
}
async function downloadCatalog(){
 let saved;
 try{saved=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");}catch{}
 if(saved&&Date.now()-saved.savedAt<CACHE_MS&&Array.isArray(saved.records)){
  return {records:saved.records,source:"Cached CelesTrak metadata",updated:saved.savedAt};
 }
 try{
  const response=await fetch(CATALOG_URL,{mode:"cors",credentials:"omit",signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error("HTTP "+response.status);
  const rows=normalizeCatalog(await response.json());
  if(!rows.length)throw Error("No verified records");
  const savedAt=Date.now();
  try{localStorage.setItem(CACHE_KEY,JSON.stringify({records:rows,savedAt}));}catch{}
  return {records:rows,source:"CelesTrak public OMM metadata",updated:savedAt};
 }catch{
  if(saved&&Array.isArray(saved.records)){
   return {records:saved.records,source:"Stale cached metadata — network unavailable",updated:saved.savedAt};
  }
  return {records:[],source:"Public station catalog unavailable",updated:null};
 }
}
export function loadCatalogContext(){
 if(!catalogPromise)catalogPromise=downloadCatalog();
 return catalogPromise;
}

// Idealized two-body TLI coast, not ascent, targeting, flyby, or COLA.
// Kepler's equation M=E-e*sin(E) ensures motion slows near apogee.
const MU=398600.4418,RE=6378.137,DAY=86400000;
export function idealTransferDays(parkingKm=200,moonDistanceKm=384400){
 const rp=RE+parkingKm,ra=moonDistanceKm;
 if(!(rp>RE&&ra>rp))throw new RangeError("Invalid reference orbit");
 return Math.PI*Math.sqrt(((rp+ra)/2)**3/MU)/86400;
}
export function keplerTransferPoint(fraction,{parkingKm=200,moonDistanceKm=384400}={}){
 const t=Math.max(0,Math.min(1,fraction)),rp=RE+parkingKm,ra=moonDistanceKm;
 if(!(rp>RE&&ra>rp))throw new RangeError("Invalid transfer radii");
 const a=(rp+ra)/2,e=(ra-rp)/(ra+rp),M=Math.PI*t;
 let E=M;
 for(let k=0;k<24;k++){
  const step=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
  E-=step;
  if(Math.abs(step)<1e-12)break;
 }
 const radius=a*(1-e*Math.cos(E));
 const nu=Math.atan2(Math.sqrt(1-e*e)*Math.sin(E),Math.cos(E)-e);
 const x=102+442*(-radius*Math.cos(nu)+rp)/(ra+rp);
 const y=151-20*(radius-rp)/(ra-rp)-155*radius*Math.sin(nu)/ra;
 return {x,y,radiusKm:radius,trueAnomalyRad:nu,elapsedFraction:t};
}
// Compatibility name for earlier educational-render callers.
export function demoShipPoint(t){const {x,y}=keplerTransferPoint(t);return {x,y};}
export function mountOrbitAnimation(host,{scenario="original",parkingKm=200,moonDistanceKm=384400,flightDays=null,departureUtc=null}={}){
 if(!host||typeof document==="undefined")return {destroy(){},setCatalog(){},setTransfer(){}};
 const accent=scenario==="optimized"?"#8eb9ff":"#66ead7";
 host.innerHTML='<div class="orbit-scene"><div class="orbit-title">Idealized Earth-to-Moon transfer</div>'+
  '<p class="orbit-subtitle">Two-body Kepler timing · geometric visualization (scale compressed) · no targeting or collision screening.</p>'+
  '<svg viewBox="0 0 640 210" role="img" aria-label="Educational transfer: Keplerian spacecraft motion from Earth parking orbit toward the approximate lunar orbital radius, not a validated flight trajectory.">'+
  '<circle cx="102" cy="151" r="24" fill="#4d8db6"/><path data-meridian d="M88 127 Q108 151 88 175" stroke="#b9e9ff" fill="none" stroke-width="2"/>'+
  '<path data-track fill="none" stroke="'+accent+'" stroke-width="3" stroke-dasharray="7 5"/>'+
  '<circle cx="544" cy="131" r="16" fill="#c0cbd5"/>'+
  '<g data-ship transform="translate(102,151)"><path d="M0,-8 L6,7 L0,4 L-6,7Z" fill="'+accent+'" stroke="#fff" stroke-width="1"/></g>'+
  '<text x="64" y="194" fill="#bcdde9" font-size="13">Earth</text><text x="513" y="177" fill="#bcdde9" font-size="13">Lunar orbital radius</text>'+
  '</svg>'+
  '<div class="orbit-controls"><button type="button" data-orbit-toggle>Pause</button>'+
  '<input type="range" data-orbit-scrub min="0" max="1000" step="1" value="0" aria-label="Kepler transfer elapsed fraction">'+
  '<span data-orbit-phase class="orbit-phase">Elapsed 0.00 d</span></div>'+
  '<div class="orbit-legend">Physical time-of-flight parameterization; launch ascent, lunar arrival interception, Earth-Moon perturbations and any collision avoidance are NOT modeled. No live satellite positions are depicted.</div>'+
  '<div class="orbit-catalog" data-orbit-catalog>Loading limited public station metadata…</div></div>';
 const qs=x=>host.querySelector(x);
 const track=qs("[data-track]"),ship=qs("[data-ship]"),meridian=qs("[data-meridian]");
 const scrub=qs("[data-orbit-scrub]"),phase=qs("[data-orbit-phase]"),button=qs("[data-orbit-toggle]");
 const scene={parkingKm,moonDistanceKm,flightDays:flightDays??idealTransferDays(parkingKm,moonDistanceKm),departureUtc};
 let alive=true,playing=!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,t=0,last=0,raf=0;
 const drawTrack=()=>{
  track.setAttribute("d",Array.from({length:201},(_,i)=>{
   const p=keplerTransferPoint(i/200,scene);
   return (i?"L":"M")+p.x.toFixed(2)+","+p.y.toFixed(2);
  }).join(" "));
 };
 function redraw(){
  const p=keplerTransferPoint(t,scene);
  ship.setAttribute("transform","translate("+p.x.toFixed(2)+","+p.y.toFixed(2)+")");
  // Reference Earth turns about once per sidereal day; orientation is illustrative.
  meridian.setAttribute("transform","rotate("+(360*scene.flightDays*t/0.99726968).toFixed(2)+" 102 151)");
  scrub.value=Math.round(t*1000);
  const elapsed=(scene.flightDays*t).toFixed(2)+" / "+scene.flightDays.toFixed(2)+" days";
  const utc=Number.isFinite(scene.departureUtc)?
   " · "+new Date(scene.departureUtc+scene.flightDays*t*DAY).toISOString().slice(0,16).replace("T"," ")+" UTC":"";
  phase.textContent=elapsed+utc;
 }
 function frame(now){
  if(!alive||!host.isConnected)return;
  if(playing&&last)t=Math.min(1,t+(now-last)/20000);
  if(t>=1){playing=false;button.textContent="Replay";}
  last=now;redraw();raf=requestAnimationFrame(frame);
 }
 function setCatalog(data){
  if(!alive)return;
  const records=data?.records||[];
  const catalog=qs("[data-orbit-catalog]");
  catalog.innerHTML='<b>Public station catalog (metadata only):</b> '+escapeHTML(data?.source||"Unavailable")+
   (data?.updated?" · downloaded "+escapeHTML(new Date(data.updated).toISOString().slice(0,16))+" UTC":"")+
   '. These are NOT real-time propagated coordinates and NOT COLA screening.'+
   (records.length?'<ul>'+records.map(o=>'<li>'+escapeHTML(o.name)+" (ID "+escapeHTML(o.id)+", epoch "+escapeHTML(o.epoch.slice(0,10))+')</li>').join("")+'</ul>':
   '<p>No orbiting-object positions have been plotted.</p>');
 }
 function setTransfer({flightDays:days,parkingKm:alt,moonDistanceKm:distance,departureUtc:launch}={}){
  if(Number.isFinite(alt)&&alt>=160&&alt<=2000)scene.parkingKm=alt;
  if(Number.isFinite(distance)&&distance>300000&&distance<450000)scene.moonDistanceKm=distance;
  scene.flightDays=Number.isFinite(days)&&days>0?days:idealTransferDays(scene.parkingKm,scene.moonDistanceKm);
  scene.departureUtc=Number.isFinite(launch)?launch:null;
  t=0;last=0;drawTrack();redraw();
 }
 button.addEventListener("click",()=>{
  if(t>=1)t=0;
  playing=!playing;button.textContent=playing?"Pause":"Play";last=0;
 });
 scrub.addEventListener("input",()=>{
  t=Number(scrub.value)/1000;playing=false;button.textContent="Play";redraw();
 });
 button.textContent=playing?"Pause":"Play";
 drawTrack();redraw();raf=requestAnimationFrame(frame);
 return {setCatalog,setTransfer,destroy(){alive=false;cancelAnimationFrame(raf);}};
}
