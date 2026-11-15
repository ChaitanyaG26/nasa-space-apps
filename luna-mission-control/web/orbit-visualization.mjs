/* LUNA rotatable 3D science outreach scene.
 * An Earth-centered, equatorial-of-date APPROXIMATION: NASA/JPL high-precision
 * vectors, spacecraft targeting and official launch conjunction screening are
 * not available here. Catalog OMM records are descriptive metadata, NOT
 * propagated real-time satellite positions. The transfer NEVER avoids objects.
 */
const CATALOG_URL="https://celestrak.org/NORAD/elements/gp.php?GROUP=STATIONS&FORMAT=JSON";
const CACHE_KEY="luna-stations-catalog-2026-v2";
const CACHE_MS=2*60*60*1000;
const DAY=86400000,MU=398600.4418,RE=6378.137,DEG=Math.PI/180;
let catalogPromise;
const escapeHTML=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const radians=(deg)=>deg*DEG;
const add=(a,b)=>a.map((n,i)=>n+b[i]);
const mul=(a,k)=>a.map(n=>n*k);
const dot=(a,b)=>a.reduce((acc,n,i)=>acc+n*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/Math.max(1e-8,Math.hypot(...a)));
export function skyDirection(raDeg,decDeg){
 const a=radians(raDeg),d=radians(decDeg);
 return [Math.cos(a)*Math.cos(d),Math.sin(a)*Math.cos(d),Math.sin(d)];
}
export function normalizeCatalog(records){
 if(!Array.isArray(records))return [];
 return records.filter(r=>r&&typeof r.OBJECT_NAME==="string"&&
  Number.isFinite(Number(r.NORAD_CAT_ID))&&Number.isFinite(Date.parse(r.EPOCH)))
 .slice(0,12).map(r=>({name:r.OBJECT_NAME.slice(0,48),id:String(r.NORAD_CAT_ID),
  epoch:r.EPOCH,meanMotion:Number(r.MEAN_MOTION)||null,inclination:Number(r.INCLINATION)||null}));
}
export function catalogAgeDays(record,now=Date.now()){
 const epoch=Date.parse(record?.epoch||"");
 return Number.isFinite(epoch)?Math.abs(now-epoch)/DAY:null;
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
  if(!rows.length)throw Error("No valid records");
  const savedAt=Date.now();
  try{localStorage.setItem(CACHE_KEY,JSON.stringify({records:rows,savedAt}));}catch{}
  return {records:rows,source:"CelesTrak public OMM metadata",updated:savedAt};
 }catch{
  if(saved&&Array.isArray(saved.records))
   return {records:saved.records,source:"STALE cache · request unavailable",updated:saved.savedAt};
  return {records:[],source:"Public station catalog unavailable",updated:null};
 }
}
export function loadCatalogContext(){
 if(!catalogPromise)catalogPromise=downloadCatalog();
 return catalogPromise;
}
export function idealTransferDays(parkingKm=200,moonDistanceKm=384400){
 const rp=RE+parkingKm,ra=moonDistanceKm;
 if(!(rp>RE&&ra>rp))throw new RangeError("Invalid reference orbit");
 return Math.PI*Math.sqrt(((rp+ra)/2)**3/MU)/86400;
}
/** Earth-centered two-body vis-viva speed; not a lunar gravity capture model. */
export function transferDynamicsAt(fraction,{parkingKm=200,moonDistanceKm=384400}={}){
 const p=keplerTransferPoint(fraction,{parkingKm,moonDistanceKm});
 const rp=RE+parkingKm,a=(rp+moonDistanceKm)/2;
 const speed=Math.sqrt(MU*(2/p.radiusKm-1/a));
 const vParking=Math.sqrt(MU/rp),vPerigee=Math.sqrt(MU*(2/rp-1/a));
 return {radiusKm:p.radiusKm,speedKmS:speed,specificEnergyKm2S2:-MU/(2*a),
  tliDeltaVKmS:vPerigee-vParking,flightDays:idealTransferDays(parkingKm,moonDistanceKm)};
}
export function keplerTransferPoint(fraction,{parkingKm=200,moonDistanceKm=384400}={}){
 const t=clamp(fraction,0,1),rp=RE+parkingKm,ra=moonDistanceKm;
 if(!(rp>RE&&ra>rp))throw new RangeError("Invalid transfer radii");
 const a=(rp+ra)/2,e=(ra-rp)/(ra+rp),M=Math.PI*t;
 let E=M;
 for(let k=0;k<28;k++){
  const step=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
  E-=step;if(Math.abs(step)<1e-12)break;
 }
 const radius=a*(1-e*Math.cos(E));
 const nu=Math.atan2(Math.sqrt(1-e*e)*Math.sin(E),Math.cos(E)-e);
 const x=102+442*(-radius*Math.cos(nu)+rp)/(ra+rp);
 const y=151-20*(radius-rp)/(ra-rp)-155*radius*Math.sin(nu)/ra;
 return {x,y,radiusKm:radius,trueAnomalyRad:nu,elapsedFraction:t};
}
export function demoShipPoint(t){
 if(t<=0)return{x:102,y:151};if(t>=1)return{x:544,y:131};
 const{x,y}=keplerTransferPoint(t);return{x,y};
}
// Compact, approximate geocentric solar direction; NOT a Horizons state vector.
function sunDirection(utc){
 const days=(utc-Date.UTC(2000,0,1,12))/DAY,mean=(357.529+0.98560028*days)*DEG;
 const lambda=(280.459+0.98564736*days+1.915*Math.sin(mean)+.020*Math.sin(2*mean))*DEG;
 const eps=(23.439-0.00000036*days)*DEG;
 return unit([Math.cos(lambda),Math.sin(lambda)*Math.cos(eps),Math.sin(lambda)*Math.sin(eps)]);
}
const sphereScale=distance=>21+194*Math.pow(clamp((distance-(RE+200))/(384400-(RE+200)),0,1),.64);
export function cameraProject(p,{yaw=0.4,pitch=.38,zoom=1,panX=0,panY=0}={}){
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const x=cy*p[0]-sy*p[1],y=sy*p[0]+cy*p[1];
 return{x:380+panX+x*zoom,y:213+panY-(sp*y+cp*p[2])*zoom,depth:cp*y-sp*p[2]};
}
// This idealized two-body half-ellipse is aligned with the Moon's estimated
// arrival direction and distance. Matching its endpoint is an animation
// constraint, NOT an actual patched-conics or COLA-validated mission transfer.
export function idealizedMoonIntercept(t,arrivalMoon,parkingKm=200){
 const arrivalDir=skyDirection(arrivalMoon.ra,arrivalMoon.dec);
 const normal=unit(cross(arrivalDir,[0,0,1]));
 const peri=mul(arrivalDir,-1),along=unit(cross(normal,peri));
 const p=keplerTransferPoint(t,{parkingKm,moonDistanceKm:arrivalMoon.distanceKm});
 const dir=add(mul(peri,Math.cos(p.trueAnomalyRad)),mul(along,Math.sin(p.trueAnomalyRad)));
 return mul(dir,p.radiusKm);
}
function phaseWorld(t,scene,arrivalMoon){
 const p=idealizedMoonIntercept(t,arrivalMoon,scene.parkingKm);
 return mul(unit(p),sphereScale(Math.hypot(...p)));
}
export function smoothTransferFractions(count=1200){
 return Array.from({length:count+1},(_,i)=>(1-Math.cos(Math.PI*i/count))/2);
}
function createStars(count=110){
 let seed=90210;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 return Array.from({length:count},()=>({x:rand()*560,y:rand()*540,r:.4+rand()*1.2,a:.17+rand()*.6}));
}
const STARFIELD=createStars();
// Cinematic burn cues only: the idealized two-body path is NOT changed by thrust.
export function thrusterPhaseAt(f){
 const t=clamp(f,0,1);
 if(t<.04)return "Departure burn · illustrative";
 if(t>=.47&&t<.495)return "Correction burn · illustrative";
 if(t>=.97)return "Arrival burn · illustrative";
 return null;
}
export function mountOrbitAnimation(host,{
 scenario="original",parkingKm=200,moonDistanceKm=384400,flightDays=null,
 departureUtc=null,moonEphemeris=null,sunEphemeris=null
}={}){
 if(!host||typeof document==="undefined")return{destroy(){},setCatalog(){},setTransfer(){}};
 const accent=scenario==="optimized"?"#59abff":"#f7d45c";
 host.innerHTML='<section class="orbit-scene orbit-scene-3d">'+
  '<div class="orbit-scene-top"><div><div class="orbit-title">Interactive 3D transfer concept</div>'+
  '<p class="orbit-subtitle">Rotate by dragging · Shift+drag to pan · wheel to zoom · Kepler time-of-flight</p></div>'+
  '<span class="orbit-data-flag">NOT COLA CLEARED</span></div>'+
  '<div class="orbit-source-tag" data-orbit-source>Moon/Sun: analytic ephemeris · updating JPL cache</div>'+
  '<canvas class="orbit-3d-canvas" width="560" height="540" tabindex="0" aria-label="Interactive 3D Earth-Moon transfer diagram with Sun direction, rotating Earth, changing Moon location and Kepler-timed spacecraft; not a trajectory solution."></canvas>'+
  '<div class="orbit-controls"><button data-orbit-toggle type="button">Pause</button>'+
  '<button data-orbit-reset type="button">Reset camera</button>'+
  '<input data-orbit-scrub type="range" min="0" max="1000" step="1" value="0" aria-label="Conceptual transit fraction">'+
  '<span data-orbit-phase class="orbit-phase">Elapsed 0.00 d</span>'+
 '<span data-orbit-burn class="orbit-burn-indicator">Coasting</span></div>'+
 '<div class="orbit-physics-telemetry" data-orbit-telemetry></div>'+
  '</section>';
 const qs=s=>host.querySelector(s),canvas=qs("canvas"),ctx=canvas.getContext("2d");
 if(!ctx)return{destroy(){},setCatalog(){},setTransfer(){}};
 const pixelRatio=clamp(window.devicePixelRatio||1,1,2);
 canvas.width=Math.round(560*pixelRatio);canvas.height=Math.round(540*pixelRatio);
 ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
 ctx.lineJoin="round";ctx.lineCap="round";
 const toggle=qs("[data-orbit-toggle]"),reset=qs("[data-orbit-reset]"),
  scrub=qs("[data-orbit-scrub]"),phase=qs("[data-orbit-phase]"),burnIndicator=qs("[data-orbit-burn]");
 const scene={parkingKm,moonDistanceKm,flightDays:flightDays??idealTransferDays(parkingKm,moonDistanceKm),
  departureUtc:Number.isFinite(departureUtc)?departureUtc:Date.parse("2026-11-20T00:00:00Z")};
 const camera={yaw:.55,pitch:.55,zoom:1.06,panX:-112,panY:62};
 let alive=true,t=0,last=0,raf=0,dragging=null,visible=true,cachedTrack=null;
 let playing=!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
 const pauseText=()=>{toggle.textContent=playing?"Pause":t>=1?"Replay":"Play";};
 const observer=typeof IntersectionObserver==="function"?new IntersectionObserver(entries=>{
  visible=entries.some(x=>x.isIntersecting);
 },{threshold:.03}):null;
 observer?.observe(canvas);
 const drawLine=(points,color,width=1,dash=[])=>{
  if(points.length<2)return;
  ctx.beginPath();points.forEach((p,i)=>{const v=cameraProject(p,camera);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y);});
  ctx.lineWidth=width;ctx.strokeStyle=color;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
 };
 const text=(label,x,y,color="#d4e8f3")=>{ctx.fillStyle=color;ctx.font="12px system-ui,sans-serif";ctx.fillText(label,x,y);};
 const bubble=(vec,radius,fill,outline,label,sunVector=[1,0,0],atmosphere=false)=>{
  const p=cameraProject(vec,camera),r=Math.max(2,radius*camera.zoom);
  const sunP=cameraProject(add(vec,sunVector),camera),centerP=cameraProject(vec,camera);
  const dx=sunP.x-centerP.x,dy=sunP.y-centerP.y,m=Math.hypot(dx,dy)||1;
  const shade=ctx.createRadialGradient(p.x+r*.38*dx/m,p.y+r*.38*dy/m,1,p.x,p.y,r*1.08);
  shade.addColorStop(0,"#f4f8ff");shade.addColorStop(.23,fill);
  shade.addColorStop(.68,outline);shade.addColorStop(1,"#101b2c");
  if(atmosphere){
   ctx.beginPath();ctx.arc(p.x,p.y,r*1.29,0,2*Math.PI);
   ctx.strokeStyle="#5acbff7b";ctx.lineWidth=Math.max(1,r*.13);
   ctx.shadowColor="#3e9cf0";ctx.shadowBlur=16;ctx.stroke();ctx.shadowBlur=0;
  }
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,2*Math.PI);ctx.fillStyle=shade;ctx.fill();
  ctx.strokeStyle="#c3dfff80";ctx.lineWidth=.7;ctx.stroke();
  text(label,p.x+r+7,p.y+4);
 };
 function ephemAt(time){
  try{
   const m=typeof moonEphemeris==="function"?moonEphemeris(time):null;
   if(m&&Number.isFinite(m.ra)&&Number.isFinite(m.dec)&&Number.isFinite(m.distanceKm))
    return m;
  }catch{/* Cache coverage gaps revert to explicit analytic fallback. */}
  return{ra:((time/86400000*13.176)%360+360)%360,dec:5*Math.sin(time/86400000*.2),distanceKm:384400};
 }
 function fitCamera(){
  const arrival=ephemAt(scene.departureUtc+scene.flightDays*DAY);
  const cloud=Array.from({length:121},(_,i)=>phaseWorld(i/120,scene,arrival));
  cloud.push([0,0,0],mul(skyDirection(arrival.ra,arrival.dec),sphereScale(arrival.distanceKm)));
  const raw=cloud.map(v=>cameraProject(v,{...camera,zoom:1,panX:0,panY:0}));
  const xs=raw.map(p=>p.x),ys=raw.map(p=>p.y);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const z=clamp(Math.min(430/Math.max(1,x1-x0),420/Math.max(1,y1-y0)),.5,1.85);
  camera.zoom=z;
  camera.panX=280-(380+((x0+x1)/2-380)*z);
  camera.panY=270-(213+((y0+y1)/2-213)*z);
 }
 fitCamera();
 function draw(){
  ctx.clearRect(0,0,560,540);
  const gradient=ctx.createLinearGradient(0,0,560,540);
  gradient.addColorStop(0,"#03111f");gradient.addColorStop(.68,"#0a263d");gradient.addColorStop(1,"#071626");
  ctx.fillStyle=gradient;ctx.fillRect(0,0,560,540);
  for(const st of STARFIELD){ctx.globalAlpha=st.a;ctx.fillStyle="#daedff";ctx.beginPath();ctx.arc(st.x,st.y,st.r,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  const when=scene.departureUtc+t*scene.flightDays*DAY;
  const atArrival=ephemAt(scene.departureUtc+scene.flightDays*DAY);
  let source=sunDirection(when);
  if(typeof sunEphemeris==="function"){
   try{
    const officialSun=sunEphemeris(when);
    if(officialSun&&Number.isFinite(officialSun.ra)&&Number.isFinite(officialSun.dec))
     source=skyDirection(officialSun.ra,officialSun.dec);
   }catch{/* UTC outside JPL coverage: lower-precision fallback */}
  }
  // Thin parking-orbit reference near Earth. It is not an ascent path.
  drawLine(Array.from({length:97},(_,i)=>{
   const theta=i*Math.PI*2/96;return [23*Math.cos(theta),23*Math.sin(theta),0];
  }),"#487ba43e",1.1,[2,7]);
  const ephem=ephemAt(when),moon=mul(skyDirection(ephem.ra,ephem.dec),sphereScale(ephem.distanceKm));
  if(!cachedTrack)cachedTrack=smoothTransferFractions().map(f=>({t:f,p:phaseWorld(f,scene,atArrival)}));
  drawLine(cachedTrack.map(v=>v.p),"#7fd9f065",1.5,[5,7]);
  let lo=0,hi=cachedTrack.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(cachedTrack[mid].t<t)lo=mid+1;else hi=mid;}
  const ship=phaseWorld(t,scene,atArrival);
  ctx.shadowColor=accent;ctx.shadowBlur=7;
  drawLine([...cachedTrack.slice(0,Math.max(1,lo)).map(v=>v.p),ship],accent,3);
  ctx.shadowBlur=0;
  const sun=mul(source,235);
  const sunPt=cameraProject(sun,camera);
  const rays=ctx.createRadialGradient(sunPt.x,sunPt.y,2,sunPt.x,sunPt.y,65*camera.zoom);
  rays.addColorStop(0,"#ffe7a988");rays.addColorStop(1,"#ffc84e00");
  ctx.fillStyle=rays;ctx.beginPath();ctx.arc(sunPt.x,sunPt.y,65*camera.zoom,0,Math.PI*2);ctx.fill();
  // Draw bodies and markers with strong visual hierarchy, separate from catalog data.
  bubble([0,0,0],12,"#4c9fd6","#13406a","Earth",source,true);
  const eq=cameraProject([0,0,0],camera),angle=2*Math.PI*(when/86164090.5);
  ctx.strokeStyle="#c5f4ff9a";ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(eq.x+Math.cos(angle)*11*camera.zoom,eq.y-11*camera.zoom);
  ctx.quadraticCurveTo(eq.x-Math.sin(angle)*16*camera.zoom,eq.y,eq.x-Math.cos(angle)*11*camera.zoom,eq.y+11*camera.zoom);ctx.stroke();
  bubble(moon,7.5,"#d5dbe3","#5b718a",t>=.999?"Moon · arrival":"Moon",source);
  bubble(sun,12,"#ffd875","#d78b16","Sun direction",source);
  const sc=cameraProject(ship,camera);
  const burn=thrusterPhaseAt(t);
  if(burn){
   // Flame points opposite projected velocity; this does not simulate propulsion.
   const prior=cameraProject(phaseWorld(clamp(t-.001,0,1),scene,atArrival),camera);
   const next=cameraProject(phaseWorld(clamp(t+.001,0,1),scene,atArrival),camera);
   const length=Math.hypot(next.x-prior.x,next.y-prior.y)||1;
   const vx=(next.x-prior.x)/length,vy=(next.y-prior.y)/length;
   const nx=-vy,ny=vx,tip=17+5*Math.sin(t*1100);
   const bx=sc.x-vx*6,by=sc.y-vy*6;
   ctx.save();ctx.shadowColor="#ffd555";ctx.shadowBlur=16;
   ctx.beginPath();ctx.moveTo(bx+3*nx,by+3*ny);
   ctx.lineTo(bx-tip*vx,by-tip*vy);ctx.lineTo(bx-3*nx,by-3*ny);ctx.closePath();
   ctx.fillStyle="#ffcb53";ctx.fill();ctx.restore();
   ctx.beginPath();ctx.arc(bx-tip*vx,by-tip*vy,1.8,0,Math.PI*2);
   ctx.fillStyle="#fff8ce";ctx.fill();
  }
  burnIndicator.textContent=burn||"Coasting";
  burnIndicator.classList.toggle("burn-active",Boolean(burn));
  ctx.beginPath();ctx.arc(sc.x,sc.y,5.2,0,Math.PI*2);ctx.fillStyle=accent;ctx.shadowColor=accent;ctx.shadowBlur=16;ctx.fill();ctx.shadowBlur=0;
  text(t>=.999?"Arrival · illustrated":"Spacecraft",sc.x+10,sc.y-8,accent);
  ctx.fillStyle="#97b8d4";ctx.font="10px system-ui,sans-serif";
  ctx.fillText("Earth · Moon · Sun",13,22);
  scrub.value=Math.round(t*1000);
  const utc=new Date(when).toISOString().slice(0,16).replace("T"," ");
  phase.textContent=(scene.flightDays*t).toFixed(2)+" / "+scene.flightDays.toFixed(2)+" d · "+utc+" UTC";
  const dyn=transferDynamicsAt(t,scene);
  qs("[data-orbit-telemetry]").textContent="Earth range "+Math.round(dyn.radiusKm).toLocaleString()+" km · "+
   "speed "+dyn.speedKmS.toFixed(2)+" km/s · idealized TLI "+dyn.tliDeltaVKmS.toFixed(2)+" km/s";
 }
 function frame(now){
  if(!alive||!host.isConnected)return;
  if(visible&&!document.hidden){
   if(playing&&last)t=Math.min(1,t+Math.max(0,Math.min(50,now-last))/36000);
   if(t>=1&&playing){playing=false;pauseText();}
   draw();
  }
  last=now;raf=requestAnimationFrame(frame);
 }
 function setCatalog(data){
  // Catalog metadata is available to the parent methodology panel, never
  // interpreted as a propagated encounter or spacecraft clearance.
  host.dataset.catalogRecords=String(data?.records?.length||0);
  host.dataset.catalogSource=data?.source||"Unavailable";
 }
 function setEphemerides(moon,sun){
  const arrival=scene.departureUtc+scene.flightDays*DAY;
  let verified=false;
  try{
   const m=typeof moon==="function"?moon(arrival):null;
   const sol=typeof sun==="function"?sun(arrival):null;
   verified=Boolean(m&&sol&&Number.isFinite(m.distanceKm)&&Number.isFinite(sol.distanceKm));
  }catch{/* Requested mission is outside the JPL cache window. */}
  if(verified){
   moonEphemeris=moon;sunEphemeris=sun;
   qs("[data-orbit-source]").textContent=
    "Moon/Sun: JPL Horizons ICRF vectors · 1 h Hermite interpolation";
  }else{
   qs("[data-orbit-source]").textContent=
    "Moon/Sun: approximate theory (JPL vectors outside mission date)";
  }
  cachedTrack=null;fitCamera();draw();
 }
 function setTransfer({flightDays:days,parkingKm:alt,moonDistanceKm:distance,departureUtc:launch}={}){
  if(Number.isFinite(alt)&&alt>=160&&alt<=2000)scene.parkingKm=alt;
  if(Number.isFinite(distance)&&distance>300000&&distance<450000)scene.moonDistanceKm=distance;
  scene.flightDays=Number.isFinite(days)&&days>0?days:idealTransferDays(scene.parkingKm,scene.moonDistanceKm);
  if(Number.isFinite(launch))scene.departureUtc=launch;
  t=0;last=0;cachedTrack=null;playing=false;fitCamera();pauseText();draw();
 }
 function startDrag(e){canvas.setPointerCapture(e.pointerId);dragging={x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2};}
 function moveDrag(e){
  if(!dragging)return;
  const scale=560/Math.max(1,canvas.getBoundingClientRect().width),dx=(e.clientX-dragging.x)*scale,dy=(e.clientY-dragging.y)*scale;
  if(dragging.pan){camera.panX+=dx;camera.panY+=dy;}
  else{camera.yaw+=dx*.007;camera.pitch=clamp(camera.pitch+dy*.007,-1.5,1.5);}
  dragging.x=e.clientX;dragging.y=e.clientY;draw();
 }
 canvas.addEventListener("pointerdown",startDrag);
 canvas.addEventListener("pointermove",moveDrag);
 canvas.addEventListener("pointerup",()=>{dragging=null;});
 canvas.addEventListener("pointercancel",()=>{dragging=null;});
 canvas.addEventListener("contextmenu",e=>e.preventDefault());
 canvas.addEventListener("wheel",e=>{e.preventDefault();camera.zoom=clamp(camera.zoom*Math.exp(-e.deltaY*.0012),.5,2.8);draw();},{passive:false});
 canvas.addEventListener("keydown",e=>{
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){
   e.preventDefault();camera.yaw+=(e.key==="ArrowLeft" ? -0.12 : e.key==="ArrowRight" ? 0.12 : 0);
   camera.pitch=clamp(camera.pitch+(e.key==="ArrowUp" ? -0.12 : e.key==="ArrowDown" ? 0.12 : 0),-1.5,1.5);
   draw();
  }
 });
 reset.addEventListener("click",()=>{Object.assign(camera,{yaw:.55,pitch:.55});fitCamera();draw();});
 toggle.addEventListener("click",()=>{if(t>=1)t=0;playing=!playing;last=0;pauseText();draw();});
 scrub.addEventListener("input",()=>{t=Number(scrub.value)/1000;playing=false;pauseText();draw();});
 pauseText();draw();raf=requestAnimationFrame(frame);
 return{setCatalog,setTransfer,setEphemerides,destroy(){alive=false;observer?.disconnect();cancelAnimationFrame(raf);}};
}
