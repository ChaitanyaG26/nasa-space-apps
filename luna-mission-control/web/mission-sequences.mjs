import {loadPolarPatch,samplePolarHeightKm} from "./lola-polar-detail.mjs";
import {destination,loadLolaGlobal} from "./lola-global.mjs";
import {loadJplReference,geometryAtUtc} from "./horizons-static.mjs?v=20261114-extent500-1";
import {descentParameters,descentAt,normalizeTerrainProfile,genericAscentAt} from "./mission-physics.mjs";
import {assessVehicle,checkPayloadMass} from "./vehicle-performance.mjs";
import {drawMissionSurface3D,loadEarthSiteGrid,loadMoonSiteGrid,LAUNCH_RANGE_COORDS} from "./mission-surface-3d.mjs?v=20261114-gold-ui-v15";
import {loadGeocentricVectors,geocentricAt} from "./horizons-geocentric.mjs?v=20261114-vector-v9";
import {earthSunAngles} from "./solar-geometry.mjs";
/* LUNA scenario-specific launch and landing cinematic visualizations.
 * Drawings show selectable historical vehicle/lander silhouettes, not actual
 * vehicle performance, compatibility, descent navigation or flight clearance.
 */
const W=600,H=278,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=t=>{const u=clamp(t,0,1);return u*u*(3-2*u);};
const escapeHTML=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// Published dimensions control geometric proportions only, not flight dynamics.
// SpaceX, NASA SLS, ULA and Firefly manufacturer data as of 2026.
export const VEHICLES={
 ksc:[
  {id:"falcon9",name:"Falcon 9",heightM:70,diameterM:3.7,boosters:0,paint:"#f1f5fc",source:"SpaceX Falcon 9"},
  {id:"falconheavy",name:"Falcon Heavy",heightM:70,diameterM:3.7,boosters:2,paint:"#e3edf8",source:"SpaceX Falcon Heavy"},
  {id:"sls",name:"Space Launch System",heightM:98.3,diameterM:8.4,boosters:2,paint:"#f79d38",source:"NASA SLS Block 1"}
 ],
 ccsfs:[
  {id:"falcon9",name:"Falcon 9",heightM:70,diameterM:3.7,boosters:0,paint:"#f1f5fc",source:"SpaceX Falcon 9"},
  {id:"vulcan",name:"Vulcan Centaur",heightM:61.6,diameterM:5.4,boosters:2,paint:"#ece5d9",source:"ULA Vulcan, standard fairing"},
  {id:"atlas",name:"Atlas V",heightM:62.5,diameterM:3.81,boosters:0,paint:"#f6e9d9",source:"NASA Atlas V"}
 ],
 vandenberg:[
  {id:"falcon9",name:"Falcon 9",heightM:70,diameterM:3.7,boosters:0,paint:"#f1f5fc",source:"SpaceX Falcon 9"},
  {id:"alpha",name:"Firefly Alpha",heightM:31.7,diameterM:1.8,boosters:0,paint:"#e2edf5",source:"Firefly Alpha 2026"}
 ]
};
export const LANDERS=[
 {id:"blueghost",name:"Blue Ghost (illustrative)",vehicle:"falcon9",body:"#e3bd65",legs:"#e6e9f4"},
 {id:"novac",name:"Nova-C (illustrative)",vehicle:"falcon9",body:"#ccd7ee",legs:"#f7f3e5"},
 {id:"peregrine",name:"Peregrine (illustrative)",vehicle:"vulcan",body:"#c6bdb7",legs:"#d9e4ed"},
 {id:"concept",name:"Generic science probe",vehicle:"any",body:"#a1ccdc",legs:"#e8f1fc"}
];
const SITE_NAMES={ksc:"KENNEDY SPACE CENTER",ccsfs:"CAPE CANAVERAL SFS",vandenberg:"VANDENBERG SFB"};
export const vehiclesForSite=id=>VEHICLES[id]||VEHICLES.ksc;
export const chooseVehicle=(site,id)=>vehiclesForSite(site).find(v=>v.id===id)||vehiclesForSite(site)[0];
export const landersForVehicle=id=>LANDERS.filter(p=>p.vehicle===id||p.vehicle==="any");
export const chooseLander=(id,vehicleId=null)=>{
 const options=vehicleId?landersForVehicle(vehicleId):LANDERS;
 return options.find(p=>p.id===id)||options[0];
};
export function illustratedSurfaceHeight(lat,lon,x=300){
 const seed=Math.sin(lat*.042+lon*.018)*.5;
 return 236+5*Math.sin(x*.035+seed)+2*Math.sin(x*.09+lon*.1);
}
export const rocketFraction=t=>ease((t-.08)/.84);
export const landerFraction=t=>ease((t-.02)/.96);

export function mountMissionSequences(host,{scenario="original",site="ksc",latitude=-89.5,longitude=0,landingUtc=null,departureUtc=null,rocket=null,lander=null,payloadKg=500}={}){
 if(!host||typeof document==="undefined")return {destroy(){},setSite(){},setTarget(){},selection(){}};
 const state={site,latitude,longitude,landingUtc,departureUtc,rocket,lander,payloadKg};
 const descent=descentParameters({altitudeM:180,entryDownSpeedMS:14,touchDownSpeedMS:.8});
 let measuredTerrain=null,terrainStatus="Loading NASA LOLA terrain…",sunElevationDeg=null,terrainRequest=0;
 let earthGrid=null,moonGrid=null,earthStatus="Loading elevation tile…",earthRequest=0;
 let earthSolarCache=null,lunarSolarCache=null,solarRequest=0;
 async function loadSolarSources(){
  const request=++solarRequest;
  const [earth,lunar]=await Promise.allSettled([loadGeocentricVectors(),loadJplReference()]);
  if(!alive||request!==solarRequest)return;
  earthSolarCache=earth.status==="fulfilled"?earth.value:null;
  lunarSolarCache=lunar.status==="fulfilled"?lunar.value:null;
  draw();
 }
 function sunAtLaunch(fraction){
  if(!earthSolarCache||!Number.isFinite(state.departureUtc))return null;
  const range=LAUNCH_RANGE_COORDS[state.site];
  if(!range)return null;
  const utc=state.departureUtc+Math.max(0,Math.min(1,fraction))*110000;
  try{return earthSunAngles(geocentricAt(earthSolarCache,utc).sun,utc,range.lat,range.lon);}
  catch{return null;}
 }
 function sunAtLanding(fraction){
  if(!lunarSolarCache||!Number.isFinite(state.landingUtc))return null;
  const utc=state.landingUtc-(1-Math.max(0,Math.min(1,fraction)))*descent.seconds*1000;
  try{
   const g=geometryAtUtc(lunarSolarCache,state.latitude,state.longitude,utc);
   return {azimuthDeg:g.sun_az,elevationDeg:g.sun_el,source:"JPL Horizons lunar local solar geometry"};
  }catch{return null;}
 }
 const solarDescription=(v,label)=>v?
  label+" · Sun "+v.azimuthDeg.toFixed(1)+"° az / "+v.elevationDeg.toFixed(1)+"° el":
  "Sun unavailable · neutral display fill";
 const cameras={launch:{yaw:.58,pitch:.68,zoom:1},landing:{yaw:.48,pitch:.68,zoom:1}};
 async function loadEarthScience(){
  const token=++earthRequest;earthGrid=null;earthStatus="Loading open elevation tile…";
  try{
   const sampled=await loadEarthSiteGrid(state.site);
   if(!alive||token!==earthRequest)return;
   earthGrid=sampled?.coverage>=.75?sampled:null;
   earthStatus=earthGrid?
    (earthGrid.source.includes("USGS")?"USGS 3DEP":"Open elevation tiles"):
    "Terrain unavailable";
  }catch{
   if(token!==earthRequest||!alive)return;
   earthStatus="Terrain unavailable";
  }
  draw();
 }
 const sampleGround=(offsetM)=>{
  if(!measuredTerrain)return 236;
  const arr=measuredTerrain.samples.filter(v=>Number.isFinite(v.heightM));
  const idx=arr.findIndex(v=>v.offsetM>=offsetM);
  let h;
  if(idx<1)h=(idx<0?arr.at(-1):arr[0]).heightM;
  else{
   const lo=arr[idx-1],hi=arr[idx],fraction=(offsetM-lo.offsetM)/(hi.offsetM-lo.offsetM);
   h=lo.heightM*(1-fraction)+hi.heightM*fraction;
  }
  return 236-2.3*(h-measuredTerrain.centerHeightM);
 };
 async function loadScience(){
  const request=++terrainRequest,lat=Number(state.latitude),lon=Number(state.longitude);
  measuredTerrain=null;moonGrid=null;terrainStatus="Checking NASA LOLA 20 m grid…";sunElevationDeg=null;
  try{
   const patch=await loadPolarPatch(lat,lon);
   if(request!==terrainRequest||!alive)return;
   if(patch){
    const samples=[];
    for(let offset=-240;offset<=240;offset+=20){
     const [p,q]=destination(lat,lon,offset>=0?90:270,Math.abs(offset)/1000);
     const km=samplePolarHeightKm(patch,p,q);
     samples.push({offsetM:offset,heightM:km===null?null:km*1000});
    }
    measuredTerrain=normalizeTerrainProfile(samples);
    moonGrid=loadMoonSiteGrid(patch,lat,lon);
   }
   if(!moonGrid||moonGrid.coverage<.7){
    const regional=await loadLolaGlobal();
    if(request!==terrainRequest||!alive)return;
    moonGrid=loadMoonSiteGrid(null,lat,lon,{global:regional});
   }
   terrainStatus=moonGrid?.coverage>=.7?(moonGrid.detail?
    "LOLA 20 m local":
    "LOLA regional · 4.5× relief"):
    "LOLA terrain unavailable";
  }catch{terrainStatus="LOLA terrain unavailable";}
  try{
   if(state.landingUtc){
    const ref=await loadJplReference();
    if(request!==terrainRequest||!alive)return;
    sunElevationDeg=geometryAtUtc(ref,lat,lon,state.landingUtc).sun_el;
   }
  }catch{sunElevationDeg=null;}
  if(request===terrainRequest&&alive)draw();
 }
 const sequenceInfo=(kind)=>{
  const launch=kind==="launch";
  return '<details class="sequence-info" data-sequence-info="'+kind+'"><summary aria-label="About '+kind+' animation" title="Data and limitations">'+
   '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="5.8" r="1" fill="currentColor"/><path d="M10 9v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></summary>'+
   '<div class="sequence-info-popover"><strong>'+(launch?"Rocket launch animation":"Lunar probe landing animation")+
   '</strong><p data-sequence-data>Loading terrain and Sun angles...</p>'+
   (launch?
    '<p>USGS 3DEP elevations are preferred, with public elevation tiles as a fallback. Native source resolution varies. Turquoise pad ring and gantry are conceptual references, not a pad survey.</p>':
    '<p>LOLA 20 m local DEM preferred; 8-ppd regional terrain (~3.8 km samples over 40 km) uses 4.5× exaggerated relief and an enlarged lander. Green/amber circles show a conceptual landing target and vicinity, never evaluated safe zones.</p>')+
   '<p>Sun geometry uses cached JPL data when available. Night scenes use artificial visibility fill. Motion, lighting and shadows are illustrative, not validated mission guidance.</p></div></details>';
 };
 const tone=scenario==="optimized"?"#62afff":"#f9d25c";
 host.innerHTML='<section class="mission-sequences" aria-label="Mission cinematic sequences">'+
  '<div class="sequence-panel"><div class="sequence-header">'+sequenceInfo("launch")+
  '<label class="sequence-vehicle-control"><span class="visually-hidden">Rocket</span><select data-rocket aria-label="Rocket type"></select></label>'+
 '<label class="sequence-payload-control"><span class="visually-hidden">Payload mass (kg)</span><input data-payload-mass type="number" min="1" max="200000" step="50" value="500" aria-label="Payload mass in kilograms" title="Payload mass (kg)" placeholder="Payload kg"></label></div>'+
  '<div class="sequence-meta" data-site-name></div>'+
 '<div class="sequence-terrain-status" data-launch-terrain></div>'+
 '<div class="vehicle-readout" data-vehicle-readout aria-live="polite"></div>'+
  '<canvas data-scene="launch" width="600" height="278" tabindex="0" aria-label="Rotatable three-dimensional rocket launch scene over open DEM terrain"></canvas>'+
 '<div class="sequence-telemetry" data-launch-telemetry></div>'+
  '<div class="sequence-playback"><button data-toggle="launch" type="button">Pause</button>'+
  '<input data-scrub="launch" type="range" min="0" max="1000" value="0" aria-label="Rocket launch animation progress"/>'+
  '<output class="visually-hidden" data-label="launch">Liftoff</output></div></div>'+
  '<div class="sequence-panel"><div class="sequence-header">'+sequenceInfo("landing")+
  '<label class="sequence-vehicle-control"><span class="visually-hidden">Landing probe</span><select data-lander aria-label="Landing probe model"></select></label></div>'+
  '<div class="sequence-meta" data-target-name></div>'+
 '<div class="sequence-terrain-status" data-landing-terrain></div>'+
  '<canvas data-scene="landing" width="600" height="278" tabindex="0" aria-label="Rotatable three-dimensional probe descent over NASA LOLA terrain"></canvas>'+
 '<div class="sequence-telemetry" data-landing-telemetry></div>'+
  '<div class="sequence-playback"><button data-toggle="landing" type="button">Pause</button>'+
  '<input data-scrub="landing" type="range" min="0" max="1000" value="0" aria-label="Lunar landing animation progress"/>'+
  '<output class="visually-hidden" data-label="landing">Approach</output></div></div></section>';
 const query=x=>host.querySelector(x);
 for(const detail of host.querySelectorAll(".sequence-info")){
  detail.addEventListener("pointerenter",()=>detail.open=true);
  detail.addEventListener("pointerleave",()=>{if(!detail.matches(":focus-within"))detail.open=false;});
  detail.addEventListener("focusout",()=>{queueMicrotask(()=>{
   if(!detail.matches(":focus-within")&&!detail.matches(":hover"))detail.open=false;
  });});
 }
 const launchSelect=query("[data-rocket]"),landingSelect=query("[data-lander]");
 const canvases={launch:query('[data-scene="launch"]'),landing:query('[data-scene="landing"]')};
 const contexts={},progress={launch:0,landing:0},playing={launch:true,landing:true};
 const outputs={launch:query('[data-label="launch"]'),landing:query('[data-label="landing"]')};
 const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
 if(reduced){playing.launch=false;playing.landing=false;}
 for(const kind of ["launch","landing"]){
  const c=canvases[kind],ctx=c.getContext("2d");
  const dpr=clamp(window.devicePixelRatio||1,1,2);
  c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);
  ctx?.setTransform(dpr,0,0,dpr,0,0);contexts[kind]=ctx;
  c.style.touchAction="none";
  let drag=null;
  c.addEventListener("pointerdown",e=>{c.setPointerCapture(e.pointerId);
   const cam=cameras[kind];drag={x:e.clientX,y:e.clientY,yaw:cam.yaw,pitch:cam.pitch};});
  c.addEventListener("pointermove",e=>{
   if(!drag)return;
   const cam=cameras[kind];cam.yaw=drag.yaw+(e.clientX-drag.x)*.008;
   cam.pitch=clamp(drag.pitch+(e.clientY-drag.y)*.007,.2,1.38);draw();
  });
  c.addEventListener("pointerup",()=>drag=null);
  c.addEventListener("pointercancel",()=>drag=null);
  c.addEventListener("wheel",e=>{e.preventDefault();const cam=cameras[kind];
   cam.zoom=clamp(cam.zoom*Math.exp(-e.deltaY*.0012),.6,1.7);draw();},{passive:false});
  c.addEventListener("keydown",e=>{
   if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
   e.preventDefault();const cam=cameras[kind];
   if(e.key==="ArrowLeft")cam.yaw-=.15;if(e.key==="ArrowRight")cam.yaw+=.15;
   if(e.key==="ArrowUp")cam.pitch=clamp(cam.pitch-.14,.2,1.38);
   if(e.key==="ArrowDown")cam.pitch=clamp(cam.pitch+.14,.2,1.38);draw();
  });
 }
 let alive=true,last=0,raf=0,visible=true;
 const observer=typeof IntersectionObserver==="function"?new IntersectionObserver(entries=>{
  visible=entries.some(e=>e.isIntersecting);
 },{threshold:.04}):null;
 observer?.observe(host);
 const syncNames=()=>{
  query("[data-site-name]").textContent=SITE_NAMES[state.site]||SITE_NAMES.ksc;
  const lat=Number(state.latitude)||0,lon=Number(state.longitude)||0;
  query("[data-target-name]").textContent=lat.toFixed(3)+"° latitude · "+lon.toFixed(3)+"° longitude";
 };
 const syncOptions=()=>{
  const options=vehiclesForSite(state.site);
  state.rocket=chooseVehicle(state.site,state.rocket).id;
  launchSelect.innerHTML=options.map(v=>'<option value="'+escapeHTML(v.id)+'">'+escapeHTML(v.name)+'</option>').join("");
  launchSelect.value=state.rocket;
  const landerOptions=landersForVehicle(state.rocket);
  state.lander=chooseLander(state.lander,state.rocket).id;
  landingSelect.innerHTML=landerOptions.map(p=>'<option value="'+escapeHTML(p.id)+'">'+escapeHTML(p.name)+'</option>').join("");
  landingSelect.value=state.lander;
  query("[data-payload-mass]").value=String(state.payloadKg);
  syncNames();
 };
 function renderVehicleAssessment(){
  const assessment=assessVehicle(state.rocket,state.payloadKg);
  const node=query("[data-vehicle-readout]");
  const mass=assessment.massProxyKg===null?"unknown":Math.round(assessment.massProxyKg).toLocaleString()+" kg";
  const thrust=assessment.thrustN===null?"unknown":(assessment.thrustN/1000000).toFixed(1)+" MN";
  const twr=assessment.initialTwrProxy===null?"unknown":assessment.initialTwrProxy.toFixed(2);
  node.textContent="Initial T/W proxy "+twr+" · "+assessment.preliminaryLEOCheck;
  node.title="Mass proxy "+mass+"; thrust "+thrust+". "+
   (assessment.limitation||"Not a verified translunar vehicle estimate.");
 }
 function drawLaunch(){
  const ctx=contexts.launch;if(!ctx)return;
  const vehicle=chooseVehicle(state.site,state.rocket),assessment=assessVehicle(state.rocket,state.payloadKg);
  const netA=assessment.initialTwrProxy!==null?
   Math.max(0,assessment.thrustN/assessment.massProxyKg-9.80665):10;
  const kin=genericAscentAt(progress.launch,{netAccelerationMS2:netA});
  ctx.clearRect(0,0,W,H);
  const sun=sunAtLaunch(progress.launch);
  drawMissionSurface3D(ctx,{grid:earthGrid,kind:"launch",camera:cameras.launch,
   altitudeM:kin.altitudeM,vehicle,progress:progress.launch,width:W,height:H,sun});
  query("[data-launch-terrain]").textContent=earthStatus+
   (sun?" · Sun "+sun.elevationDeg.toFixed(1)+"°":" · no Sun data");
  query('[data-sequence-info="launch"] [data-sequence-data]').textContent=
   (SITE_NAMES[state.site]||state.site)+" · "+(earthGrid?.source||earthStatus)+". "+
   solarDescription(sun,"Launch site")+" · relief 2×; gantry conceptual. "+
   query("[data-vehicle-readout]").textContent;
  query("[data-launch-telemetry]").textContent=
   "T+"+kin.elapsedS.toFixed(0)+" s · "+(kin.altitudeM/1000).toFixed(2)+" km (modeled)";
 }
 function drawLanding(){
  const ctx=contexts.landing;if(!ctx)return;
  const t=progress.landing,flight=descentAt(t,descent),probe=chooseLander(state.lander,state.rocket);
  ctx.clearRect(0,0,W,H);
  const sun=sunAtLanding(t);
  drawMissionSurface3D(ctx,{grid:moonGrid?.coverage>=.7?moonGrid:null,kind:"landing",camera:cameras.landing,
   altitudeM:flight.heightM,lander:probe,progress:t,width:W,height:H,sun});
  query("[data-landing-terrain]").textContent=terrainStatus+
   (sun?" · Sun "+sun.elevationDeg.toFixed(1)+"°":" · no Sun data");
  query('[data-sequence-info="landing"] [data-sequence-data]').textContent=
   state.latitude.toFixed(3)+"°, "+state.longitude.toFixed(3)+"° · "+
   (moonGrid?.source||terrainStatus)+". "+solarDescription(sun,"Lunar site")+
   (moonGrid?.detail?". Relief 1.25×.":". Regional relief 4.5×; local hazards unresolved.");
  query("[data-landing-telemetry]").textContent=
   "Altitude "+flight.heightM.toFixed(0)+" m · "+flight.downSpeedMS.toFixed(1)+" m/s descent";
 }
 const draw=()=>{drawLaunch();drawLanding();};
 function frame(now){
  if(!alive||!host.isConnected)return;
  if(visible&&!document.hidden){
   for(const kind of ["launch","landing"]){
    if(playing[kind]&&last){
     progress[kind]=Math.min(1,progress[kind]+Math.min(50,Math.max(0,now-last))/(kind==="launch"?18000:22500));
     if(progress[kind]===1)playing[kind]=false;
    }
    query('[data-scrub="'+kind+'"]').value=String(Math.round(progress[kind]*1000));
    query('[data-toggle="'+kind+'"]').textContent=playing[kind]?"Pause":progress[kind]===1?"Replay":"Play";
   }
   outputs.launch.textContent=progress.launch>=1?"Ascent complete":rocketFraction(progress.launch)<.01?"On pad":"Ascending";
   outputs.landing.textContent=progress.landing>=1?"Touchdown":"Descent";
   draw();
  }
  last=now;raf=requestAnimationFrame(frame);
 }
 launchSelect.addEventListener("change",()=>{
  state.rocket=launchSelect.value;syncOptions();
  progress.launch=0;progress.landing=0;renderVehicleAssessment();draw();
 });
 query("[data-payload-mass]").addEventListener("change",event=>{
  try{state.payloadKg=checkPayloadMass(event.target.value);}
  catch{event.target.value=String(state.payloadKg);return;}
  progress.launch=0;renderVehicleAssessment();draw();
 });
 landingSelect.addEventListener("change",()=>{state.lander=landingSelect.value;progress.landing=0;draw();});
 for(const kind of ["launch","landing"]){
  query('[data-toggle="'+kind+'"]').addEventListener("click",()=>{
   if(progress[kind]>=1)progress[kind]=0;
   playing[kind]=!playing[kind];last=0;draw();
  });
  query('[data-scrub="'+kind+'"]').addEventListener("input",e=>{
   progress[kind]=Number(e.target.value)/1000;playing[kind]=false;draw();
  });
 }
 syncOptions();renderVehicleAssessment();draw();loadScience();loadEarthScience();loadSolarSources();raf=requestAnimationFrame(frame);
 return{
  destroy(){alive=false;terrainRequest++;earthRequest++;solarRequest++;cancelAnimationFrame(raf);observer?.disconnect();},
  setSite(id){
   if(!VEHICLES[id])return;
   state.site=id;syncOptions();progress.launch=0;renderVehicleAssessment();loadEarthScience();draw();
  },
  setTarget(lat,lon){
   if(Number.isFinite(lat)&&Number.isFinite(lon)){
    state.latitude=lat;state.longitude=lon;syncNames();progress.landing=0;loadScience();draw();
   }
  },
  setTimeline({departureUtc:depart,landingUtc:arrive}={}){
   if(Number.isFinite(depart))state.departureUtc=depart;
   if(Number.isFinite(arrive))state.landingUtc=arrive;
   draw();
  },
  selection(){return {rocket:state.rocket,lander:state.lander,payloadKg:state.payloadKg};}
 };
}
