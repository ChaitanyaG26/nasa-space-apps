import {loadPolarPatch,samplePolarHeightKm} from "./lola-polar-detail.mjs";
import {destination} from "./lola-global.mjs";
import {loadJplReference,geometryAtUtc} from "./horizons-static.mjs";
import {descentParameters,descentAt,normalizeTerrainProfile,genericAscentAt} from "./mission-physics.mjs";
import {assessVehicle,checkPayloadMass} from "./vehicle-performance.mjs";
import {drawMissionSurface3D,loadEarthSiteGrid,loadMoonSiteGrid} from "./mission-surface-3d.mjs";
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

export function mountMissionSequences(host,{scenario="original",site="ksc",latitude=-89.5,longitude=0,landingUtc=null,rocket=null,lander=null,payloadKg=500}={}){
 if(!host||typeof document==="undefined")return {destroy(){},setSite(){},setTarget(){},selection(){}};
 const state={site,latitude,longitude,landingUtc,rocket,lander,payloadKg};
 const descent=descentParameters({altitudeM:180,entryDownSpeedMS:14,touchDownSpeedMS:.8});
 let measuredTerrain=null,terrainStatus="Loading NASA LOLA terrain…",sunElevationDeg=null,terrainRequest=0;
 let earthGrid=null,moonGrid=null,earthStatus="Loading elevation tile…",earthRequest=0;
 const cameras={launch:{yaw:.58,pitch:.68,zoom:1},landing:{yaw:.48,pitch:.68,zoom:1}};
 async function loadEarthScience(){
  const token=++earthRequest;earthGrid=null;earthStatus="Loading open elevation tile…";
  try{
   const sampled=await loadEarthSiteGrid(state.site);
   if(!alive||token!==earthRequest)return;
   earthGrid=sampled?.coverage>=.75?sampled:null;
   earthStatus=earthGrid?
    "Measured public DEM · "+Math.round(earthGrid.resolutionM)+" m tile pixels":
    "Elevation coverage unavailable · flat reference only";
  }catch{
   if(token!==earthRequest||!alive)return;
   earthStatus="Terrain service unavailable · flat reference only";
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
   terrainStatus=moonGrid?.coverage>=.7?"NASA LOLA 20 m DEM · true elevation mesh":
     "No high-resolution LOLA coverage · hazards unknown";
  }catch{terrainStatus="Lunar elevation unavailable · hazards unknown";}
  try{
   if(state.landingUtc){
    const ref=await loadJplReference();
    if(request!==terrainRequest||!alive)return;
    sunElevationDeg=geometryAtUtc(ref,lat,lon,state.landingUtc).sun_el;
   }
  }catch{sunElevationDeg=null;}
  if(request===terrainRequest&&alive)draw();
 }
 const tone=scenario==="optimized"?"#62afff":"#f9d25c";
 host.innerHTML='<section class="mission-sequences" aria-label="Mission cinematic sequences">'+
  '<div class="sequence-panel"><div class="sequence-header"><strong>Launch animation</strong>'+
  '<label>Rocket<select data-rocket aria-label="Select rocket illustration"></select></label>'+
 '<label>Payload mass (kg)<input data-payload-mass type="number" min="1" max="200000" step="50" value="500" aria-label="Mission payload mass in kilograms"></label></div>'+
  '<div class="sequence-meta" data-site-name></div>'+
 '<div class="sequence-terrain-status" data-launch-terrain></div>'+
 '<div class="vehicle-readout" data-vehicle-readout aria-live="polite"></div>'+
  '<canvas data-scene="launch" width="600" height="278" tabindex="0" aria-label="Rotatable three-dimensional rocket launch scene over open DEM terrain"></canvas>'+
 '<div class="sequence-telemetry" data-launch-telemetry></div>'+
  '<div class="sequence-playback"><button data-toggle="launch" type="button">Pause</button>'+
  '<input data-scrub="launch" type="range" min="0" max="1000" value="0" aria-label="Rocket launch animation progress"/>'+
  '<output data-label="launch">Liftoff</output></div></div>'+
  '<div class="sequence-panel"><div class="sequence-header"><strong>Probe landing animation</strong>'+
  '<label>Probe<select data-lander aria-label="Select illustrative lunar landing probe"></select></label></div>'+
  '<div class="sequence-meta" data-target-name></div>'+
 '<div class="sequence-terrain-status" data-landing-terrain></div>'+
  '<canvas data-scene="landing" width="600" height="278" tabindex="0" aria-label="Rotatable three-dimensional probe descent over NASA LOLA terrain"></canvas>'+
 '<div class="sequence-telemetry" data-landing-telemetry></div>'+
  '<div class="sequence-playback"><button data-toggle="landing" type="button">Pause</button>'+
  '<input data-scrub="landing" type="range" min="0" max="1000" value="0" aria-label="Lunar landing animation progress"/>'+
  '<output data-label="landing">Approach</output></div></div></section>';
 const query=x=>host.querySelector(x);
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
 const rect=(ctx,x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
 const circle=(ctx,x,y,r,fill)=>{ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=fill;ctx.fill();};
 const line=(ctx,x,y,x2,y2,color,w=2)=>{
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke();
 };
 const write=(ctx,txt,x,y,fill="#c1dceb",size=12)=>{
  ctx.font="700 "+size+"px system-ui,sans-serif";ctx.fillStyle=fill;ctx.fillText(txt,x,y);
 };
 function sky(ctx,blue=false){
  const gradient=ctx.createLinearGradient(0,0,0,H);
  gradient.addColorStop(0,blue?"#071e39":"#020914");
  gradient.addColorStop(1,blue?"#236183":"#1b2839");
  rect(ctx,0,0,W,H,gradient);
  for(let i=0;i<45;i++){
   const x=(i*179+37)%W,y=(i*67+13)%220;
   circle(ctx,x,y,.5+(i%3)*.34,"#e8f3ff96");
  }
 }
 function renderVehicleAssessment(){
  const assessment=assessVehicle(state.rocket,state.payloadKg);
  const node=query("[data-vehicle-readout]");
  const mass=assessment.massProxyKg===null?"unknown":Math.round(assessment.massProxyKg).toLocaleString()+" kg";
  const thrust=assessment.thrustN===null?"unknown":(assessment.thrustN/1000000).toFixed(1)+" MN";
  const twr=assessment.initialTwrProxy===null?"unknown":assessment.initialTwrProxy.toFixed(2);
  node.textContent="Launch mass (proxy) "+mass+" · thrust "+thrust+
   " · initial T/W "+twr+" · "+assessment.preliminaryLEOCheck;
  node.title=assessment.limitation||"Unverified launch mass and thrust.";
 }
 function drawRocket(ctx,vehicle,x,y,phase){
  const w=vehicle.diameterM*2.45,h=vehicle.heightM*1.16,fairingH=Math.max(12,h*.16);
  ctx.save();ctx.translate(x,y);
  if(phase>0&&phase<1){
   const flare=(16+8*Math.sin(phase*83))*(.7+.3*phase);
   ctx.shadowColor="#ffb847";ctx.shadowBlur=22;
   ctx.beginPath();ctx.moveTo(-w*.45,0);ctx.quadraticCurveTo(-w*.8,flare*.5,0,flare);
   ctx.quadraticCurveTo(w*.8,flare*.5,w*.45,0);ctx.fillStyle="#ffb74c";ctx.fill();
   ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(-w*.22,0);ctx.lineTo(0,flare*.6);ctx.lineTo(w*.22,0);
   ctx.fillStyle="#fff5b4";ctx.fill();
  }
  const coreGradient=ctx.createLinearGradient(-w/2,0,w/2,0);
  coreGradient.addColorStop(0,"#738ba4");coreGradient.addColorStop(.24,vehicle.paint);
  coreGradient.addColorStop(.65,vehicle.paint);coreGradient.addColorStop(1,"#788ca0");
  rect(ctx,-w/2,-h+fairingH,w,h-fairingH,coreGradient);
  rect(ctx,-w/2,-h*.56,w,h*.07,"#101e31");
  ctx.beginPath();ctx.moveTo(-w/2,-h+fairingH);ctx.quadraticCurveTo(-w*.39,-h+2,0,-h);
  ctx.quadraticCurveTo(w*.39,-h+2,w/2,-h+fairingH);ctx.fillStyle="#e8f0f6";ctx.fill();
  for(const x0 of [-1,1].slice(0,vehicle.boosters?2:0)){
   const bx=x0*(w*.95);
   rect(ctx,bx-w*.29,-h*.79,w*.58,h*.79,"#dce6ef");
   rect(ctx,bx-w*.29,-h*.24,w*.58,h*.08,"#295171");
  }
  rect(ctx,-w*.54,-h*.06,w*1.08,h*.06,"#64798a");
  ctx.restore();
 }
 function drawLaunch(){
  const ctx=contexts.launch;if(!ctx)return;
  const vehicle=chooseVehicle(state.site,state.rocket),assessment=assessVehicle(state.rocket,state.payloadKg);
  const netA=assessment.initialTwrProxy!==null?
   Math.max(0,assessment.thrustN/assessment.massProxyKg-9.80665):10;
  const kin=genericAscentAt(progress.launch,{netAccelerationMS2:netA});
  ctx.clearRect(0,0,W,H);
  drawMissionSurface3D(ctx,{grid:earthGrid,kind:"launch",camera:cameras.launch,
   altitudeM:kin.altitudeM,vehicle,progress:progress.launch,width:W,height:H});
  query("[data-launch-terrain]").textContent=earthStatus+" · drag to orbit";
  query("[data-launch-telemetry]").textContent=
   "T+"+kin.elapsedS.toFixed(0)+" s · model altitude "+(kin.altitudeM/1000).toFixed(2)+" km · vertical speed "+
   kin.verticalSpeedMS.toFixed(0)+" m/s · altitude display compressed";
 }
 const terrainSeed=(lat,lon)=>Math.sin(lat*.042+lon*.018)*.5;
 function drawProbe(ctx,probe,x,y,t){
  ctx.save();ctx.translate(x,y);
  const col=probe.body;
  line(ctx,-19,-4,-36,21,probe.legs,3);
  line(ctx,19,-4,36,21,probe.legs,3);
  line(ctx,-36,21,-45,21,probe.legs,3);
  line(ctx,36,21,45,21,probe.legs,3);
  rect(ctx,-24,-19,48,30,col);
  rect(ctx,-18,-15,36,18,"#617485");
  rect(ctx,-21,0,42,8,"#dba84b");
  rect(ctx,-30,-12,6,12,col);rect(ctx,24,-12,6,12,col);
  line(ctx,0,-19,0,-42,"#d0e7ec",2);
  circle(ctx,0,-44,4,"#e9f5fd");
  if(t<.975&&t>.04){
   const size=clamp((.98-t)*30,7,22);
   ctx.beginPath();ctx.moveTo(-8,12);ctx.lineTo(0,12+size);ctx.lineTo(8,12);
   ctx.fillStyle="#ffd466";ctx.shadowColor="#ffbb37";ctx.shadowBlur=13;ctx.fill();
  }
  ctx.restore();
 }
 function drawLanding(){
  const ctx=contexts.landing;if(!ctx)return;
  const t=progress.landing,flight=descentAt(t,descent),probe=chooseLander(state.lander,state.rocket);
  ctx.clearRect(0,0,W,H);
  drawMissionSurface3D(ctx,{grid:moonGrid?.coverage>=.7?moonGrid:null,kind:"landing",camera:cameras.landing,
   altitudeM:flight.heightM,lander:probe,progress:t,width:W,height:H});
  query("[data-landing-terrain]").textContent=terrainStatus+" · drag to orbit";
  query("[data-landing-telemetry]").textContent=
   "Altitude "+flight.heightM.toFixed(1)+" m · descent "+flight.downSpeedMS.toFixed(2)+" m/s · "+
   "T+"+flight.elapsedS.toFixed(1)+" s · model T/W "+descent.thrustToWeight.toFixed(2);
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
 syncOptions();renderVehicleAssessment();draw();loadScience();loadEarthScience();raf=requestAnimationFrame(frame);
 return{
  destroy(){alive=false;terrainRequest++;earthRequest++;cancelAnimationFrame(raf);observer?.disconnect();},
  setSite(id){
   if(!VEHICLES[id])return;
   state.site=id;syncOptions();progress.launch=0;renderVehicleAssessment();loadEarthScience();draw();
  },
  setTarget(lat,lon){
   if(Number.isFinite(lat)&&Number.isFinite(lon)){
    state.latitude=lat;state.longitude=lon;syncNames();progress.landing=0;loadScience();draw();
   }
  },
  selection(){return {rocket:state.rocket,lander:state.lander,payloadKg:state.payloadKg};}
 };
}
