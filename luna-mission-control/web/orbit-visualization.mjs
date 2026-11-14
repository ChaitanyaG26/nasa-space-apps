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
const point=(p0,p1,p2,p3,t)=>{
 const q=1-t;return q*q*q*p0+3*q*q*t*p1+3*q*t*t*p2+t*t*t*p3;
};
export function demoShipPoint(t){
 const u=Math.max(0,Math.min(1,t));
 return {x:point(102,200,405,544,u),y:point(151,19,19,131,u)};
}
export function mountOrbitAnimation(host,{scenario="original"}={}){
 if(!host||typeof document==="undefined")return {destroy(){},setCatalog(){}};
 const accent=scenario==="optimized"?"#8eb9ff":"#66ead7";
 host.innerHTML='<div class="orbit-scene"><div class="orbit-title">Animated lunar transfer concept</div>'+
  '<p class="orbit-subtitle">Schematic positions and timing, not to scale. No flight path is planned around the catalog markers.</p>'+
  '<svg viewBox="0 0 640 210" role="img" aria-label="Animated educational orbit: Earth spins, Moon and Sun move schematically, and the spacecraft follows a highlighted transfer curve. Public catalog markers are not propagated positions.">'+
  '<circle cx="102" cy="150" r="26" fill="#4d8db6"/><path data-meridian d="M88 126 Q108 150 88 174" stroke="#b9e9ff" fill="none" stroke-width="2"/>'+
  '<path data-track d="M102 151 C200 19 405 19 544 131" stroke="'+accent+'" stroke-width="3" stroke-dasharray="8 5" fill="none"/>'+
  '<g data-satellite-markers></g>'+
  '<circle data-sun cx="574" cy="31" r="14" fill="#ffc66f"/>'+
  '<circle data-moon cx="544" cy="131" r="16" fill="#c0cbd5"/>'+
  '<g data-ship transform="translate(102,151)"><path d="M0,-8 L6,7 L0,4 L-6,7Z" fill="'+accent+'" stroke="#fff" stroke-width="1"/></g>'+
  '<text x="66" y="195" fill="#bcdde9" font-size="13">Earth</text>'+
  '<text x="529" y="177" fill="#bcdde9" font-size="13">Moon</text>'+
  '<text x="570" y="59" fill="#ffddac" font-size="12">Sun</text>'+
  '</svg>'+
  '<div class="orbit-controls"><button type="button" data-orbit-toggle>Pause</button>'+
  '<input type="range" data-orbit-scrub min="0" max="1000" step="1" value="0" aria-label="Conceptual transfer animation progress">'+
  '<span data-orbit-phase class="orbit-phase">Transfer 0%</span></div>'+
  '<div class="orbit-legend">Solid bodies and catalog markers are illustrative placements, not real-time propagated coordinates or predicted close approaches.</div>'+
  '<div class="orbit-catalog" data-orbit-catalog>Loading a small public station catalog…</div></div>';
 const qs=s=>host.querySelector(s);
 const svg=qs("svg"),path=qs("[data-track]"),ship=qs("[data-ship]"),
  moon=qs("[data-moon]"),sun=qs("[data-sun]"),meridian=qs("[data-meridian]");
 const markers=qs("[data-satellite-markers]"),scrub=qs("[data-orbit-scrub]"),
  label=qs("[data-orbit-phase]"),button=qs("[data-orbit-toggle]");
 let alive=true,playing=!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
 let t=0,last=0,raf=0,count=0;
 const NS="http://www.w3.org/2000/svg";
 const dots=[];
 function redraw(){
  const p=demoShipPoint(t),theta=2*Math.PI*t;
  ship.setAttribute("transform","translate("+p.x.toFixed(2)+","+p.y.toFixed(2)+")");
  // All moving bodies and object placements are intentionally stylized.
  moon.setAttribute("cy",(131+5*Math.sin(theta)).toFixed(2));
  moon.setAttribute("cx",(544+4*Math.sin(theta*.7)).toFixed(2));
  sun.setAttribute("cx",(574-9*Math.sin(theta*.4)).toFixed(2));
  sun.setAttribute("cy",(31+5*Math.sin(theta*.55)).toFixed(2));
  meridian.setAttribute("transform","rotate("+(360*t).toFixed(2)+" 102 150)");
  dots.forEach((d,i)=>{
   const a=theta*(1.1+i*.14)+i*1.5,r=36+i*4.2;
   d.setAttribute("cx",(102+r*Math.cos(a)).toFixed(2));
   d.setAttribute("cy",(150+r*.56*Math.sin(a)).toFixed(2));
  });
  scrub.value=Math.round(t*1000);label.textContent="Transfer "+Math.round(t*100)+"%";
 }
 function frame(now){
  if(!alive||!host.isConnected)return;
  if(playing&&last)t=(t+(now-last)/20000)%1;
  last=now;redraw();raf=requestAnimationFrame(frame);
 }
 function setCatalog(data){
  if(!alive)return;
  const records=data?.records||[];
  const catalog=qs("[data-orbit-catalog]");
  catalog.innerHTML='<b>Public catalog context:</b> '+escapeHTML(data?.source||"Unavailable")+
   (data?.updated?" · downloaded "+escapeHTML(new Date(data.updated).toISOString().slice(0,16))+" UTC":"")+
   '. These are NOT a full tracked-object database and NOT COLA screening.'+
   (records.length?'<ul>'+records.map(o=>'<li>'+escapeHTML(o.name)+" (ID "+escapeHTML(o.id)+", epoch "+escapeHTML(o.epoch.slice(0,10))+')</li>').join("")+'</ul>':
   '<p>No orbiting-object positions are shown until catalog metadata is available.</p>');
  markers.replaceChildren();dots.length=0;count=records.length;
  for(let i=0;i<count;i++){
   const dot=document.createElementNS(NS,"circle");
   dot.setAttribute("r","3.1");dot.setAttribute("fill","#81bfe2");
   dot.setAttribute("aria-hidden","true");markers.appendChild(dot);dots.push(dot);
  }
  redraw();
 }
 button.addEventListener("click",()=>{playing=!playing;button.textContent=playing?"Pause":"Play";last=0;});
 scrub.addEventListener("input",()=>{t=Number(scrub.value)/1000;playing=false;button.textContent="Play";redraw();});
 button.textContent=playing?"Pause":"Play";
 redraw();raf=requestAnimationFrame(frame);
 return {setCatalog,destroy(){alive=false;cancelAnimationFrame(raf);}};
}
