/* LUNA scenario-specific launch and landing cinematic visualizations.
 * Drawings show selectable historical vehicle/lander silhouettes, not actual
 * vehicle performance, compatibility, descent navigation or flight clearance.
 */
const W=600,H=278,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=t=>{const u=clamp(t,0,1);return u*u*(3-2*u);};
const escapeHTML=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const VEHICLES={
 ksc:[
  {id:"falcon9",name:"Falcon 9",width:14,height:86,boosters:0,paint:"#f1f5fc"},
  {id:"falconheavy",name:"Falcon Heavy",width:15,height:88,boosters:2,paint:"#e3edf8"},
  {id:"sls",name:"Space Launch System",width:23,height:92,boosters:2,paint:"#f79d38"}
 ],
 ccsfs:[
  {id:"falcon9",name:"Falcon 9",width:14,height:86,boosters:0,paint:"#f1f5fc"},
  {id:"vulcan",name:"Vulcan Centaur",width:19,height:84,boosters:2,paint:"#ece5d9"},
  {id:"atlas",name:"Atlas V",width:17,height:84,boosters:0,paint:"#f6e9d9"}
 ],
 vandenberg:[
  {id:"falcon9",name:"Falcon 9",width:14,height:86,boosters:0,paint:"#f1f5fc"},
  {id:"alpha",name:"Firefly Alpha",width:12,height:77,boosters:0,paint:"#e2edf5"}
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

export function mountMissionSequences(host,{scenario="original",site="ksc",latitude=-89.5,longitude=0,rocket=null,lander=null}={}){
 if(!host||typeof document==="undefined")return {destroy(){},setSite(){},setTarget(){},selection(){}};
 const state={site,latitude,longitude,rocket,lander};
 const tone=scenario==="optimized"?"#62afff":"#f9d25c";
 host.innerHTML='<section class="mission-sequences" aria-label="Mission cinematic sequences">'+
  '<div class="sequence-panel"><div class="sequence-header"><strong>Launch animation</strong>'+
  '<label>Rocket<select data-rocket aria-label="Select rocket illustration"></select></label></div>'+
  '<div class="sequence-meta" data-site-name></div>'+
  '<canvas data-scene="launch" width="600" height="278" aria-label="Animated rocket illustration launching from the selected range"></canvas>'+
  '<div class="sequence-playback"><button data-toggle="launch" type="button">Pause</button>'+
  '<input data-scrub="launch" type="range" min="0" max="1000" value="0" aria-label="Rocket launch animation progress"/>'+
  '<output data-label="launch">Liftoff</output></div></div>'+
  '<div class="sequence-panel"><div class="sequence-header"><strong>Probe landing animation</strong>'+
  '<label>Probe<select data-lander aria-label="Select illustrative lunar landing probe"></select></label></div>'+
  '<div class="sequence-meta" data-target-name></div>'+
  '<canvas data-scene="landing" width="600" height="278" aria-label="Animated lunar probe descending to chosen site coordinates"></canvas>'+
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
 function drawRocket(ctx,vehicle,x,y,phase){
  const w=vehicle.width,h=vehicle.height;
  ctx.save();ctx.translate(x,y);
  if(phase>.08&&phase<1){
   const flare=(16+8*Math.sin(phase*83))*(.7+.3*phase);
   ctx.shadowColor="#ffb847";ctx.shadowBlur=22;
   ctx.beginPath();ctx.moveTo(-w*.45,0);ctx.quadraticCurveTo(-w*.8,flare*.5,0,flare);
   ctx.quadraticCurveTo(w*.8,flare*.5,w*.45,0);ctx.fillStyle="#ffb74c";ctx.fill();
   ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(-w*.22,0);ctx.lineTo(0,flare*.6);ctx.lineTo(w*.22,0);
   ctx.fillStyle="#fff5b4";ctx.fill();
  }
  rect(ctx,-w/2,-h,w,h,vehicle.paint);
  rect(ctx,-w/2,-h*.56,w,h*.07,"#101e31");
  ctx.beginPath();ctx.moveTo(-w/2,-h);ctx.lineTo(0,-h-21);
  ctx.lineTo(w/2,-h);ctx.fillStyle="#e8f0f6";ctx.fill();
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
  const p=progress.launch,up=rocketFraction(p),vehicle=chooseVehicle(state.site,state.rocket);
  ctx.clearRect(0,0,W,H);sky(ctx,true);
  const coastal=state.site!=="vandenberg";
  // Site context is representational terrain, not real pad geology.
  ctx.beginPath();ctx.moveTo(0,227);
  for(let i=0;i<=W;i+=18){
   const h=coastal?2*Math.sin(i*.018):16*Math.sin(i*.012)+9*Math.sin(i*.038);
   ctx.lineTo(i,227-h);
  }
  ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fillStyle=coastal?"#294d52":"#364855";ctx.fill();
  if(coastal)rect(ctx,0,234,W,44,"#15415f");
  rect(ctx,264,222,76,12,"#758694");rect(ctx,281,213,42,10,"#a9bcc8");
  rect(ctx,232,106,7,119,"#526779");
  for(let y=118;y<208;y+=19)line(ctx,238,y,262,y-10,"#6c8190",2);
  const x=302,y=213-up*310;
  if(up>.002){
   for(let i=0;i<11;i++){
    const a=i*2.41+p*6,r=(i%5)*4+up*18;
    circle(ctx,x+Math.cos(a)*r,215+Math.sin(a)*r*.26,
      4+7*up+(i%3)*2,"#c3bfc186");
   }
  }
  drawRocket(ctx,vehicle,x,y,p);
  write(ctx,coastal?"COASTAL LAUNCH RANGE":"PACIFIC LAUNCH RANGE",14,25,"#b8d7ee",11);
  write(ctx,up>=1?"ASCENT · ILLUSTRATIVE":up>.03?"LIFTOFF · ILLUSTRATIVE":"ON THE PAD",14,48,tone,12);
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
  const t=progress.landing,u=landerFraction(t),probe=chooseLander(state.lander);
  ctx.clearRect(0,0,W,H);sky(ctx,false);
  const ground=236;
  ctx.beginPath();ctx.moveTo(0,ground);
  for(let x=0;x<=W;x+=8){
   ctx.lineTo(x,illustratedSurfaceHeight(state.latitude,state.longitude,x));
  }
  ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fillStyle="#8b96a6";ctx.fill();
  ctx.beginPath();ctx.moveTo(0,ground+12);ctx.lineTo(W,ground+12);
  ctx.strokeStyle="#d8dce8";ctx.lineWidth=1;ctx.stroke();
  const x=300+10*Math.sin(Math.PI*t)*Math.cos(t*6);
  const surfaceY=illustratedSurfaceHeight(state.latitude,state.longitude,300);
  const y=26+(surfaceY-21-26)*u; // feet meet selected illustrative surface at t=1
  // Final lander legs touch the stylized terrain (landing silhouette only).
  if(t>=.96){
   for(let i=0;i<12;i++){
    const a=i*2.7+u,r=5+i*2;
    circle(ctx,x+Math.cos(a)*r,ground+Math.sin(a)*r*.18,1.1+(i%3)*.6,"#cbd3ddaa");
   }
  }
  drawProbe(ctx,probe,x,y,t);
  ctx.beginPath();ctx.moveTo(290,ground+1);ctx.lineTo(310,ground+1);
  ctx.strokeStyle="#f9d25c";ctx.lineWidth=2;ctx.stroke();
  write(ctx,"LUNAR SURFACE · ILLUSTRATIVE",14,25,"#bed5e8",11);
  write(ctx,t>=.99?"TOUCHDOWN · CONCEPT":u>.5?"POWERED DESCENT · CONCEPT":"APPROACH · CONCEPT",14,48,tone,12);
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
  progress.launch=0;progress.landing=0;draw();
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
 syncOptions();draw();raf=requestAnimationFrame(frame);
 return{
  destroy(){alive=false;cancelAnimationFrame(raf);observer?.disconnect();},
  setSite(id){
   if(!VEHICLES[id])return;
   state.site=id;syncOptions();progress.launch=0;draw();
  },
  setTarget(lat,lon){
   if(Number.isFinite(lat)&&Number.isFinite(lon)){
    state.latitude=lat;state.longitude=lon;syncNames();progress.landing=0;draw();
   }
  },
  selection(){return {rocket:state.rocket,lander:state.lander};}
 };
}
