/** Rotatable 3D-looking Moon-fixed directional reference.
 * Uses NASA-derived unit vectors; Sun and Earth are explicitly directional
 * markers and NOT drawn at fake physical distances.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const unit=v=>{const h=Math.hypot(...v)||1;return v.map(x=>x/h);};
export function rotateVector(v,yaw,pitch){
 const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const x=c*v[0]+s*v[2],z=-s*v[0]+c*v[2];
 return [x,cp*v[1]-sp*z,sp*v[1]+cp*z];
}
export function createMoonSky3D(canvas){
 if(!canvas)return{update(){},reset(){},destroy(){}};
 const ctx=canvas.getContext("2d");
 if(!ctx)return{update(){},reset(){},destroy(){}};
 const width=320,height=134;let yaw=.48,pitch=-.33,zoom=1,press=null;
 let geometry=null,disposed=false;
 const project=v=>{
  const [x,y,z]=rotateVector(v,yaw,pitch);
  return {x:160+x*47*zoom,y:65-y*47*zoom,depth:z};
 };
 const draw=()=>{
  if(disposed)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const grad=ctx.createLinearGradient(0,0,width,height);grad.addColorStop(0,"#071827");grad.addColorStop(1,"#143449");
  ctx.fillStyle=grad;ctx.fillRect(0,0,width,height);
  ctx.lineWidth=1;ctx.strokeStyle="#3c63788a";
  for(const a of [0,Math.PI/2]){
   ctx.beginPath();
   for(let i=0;i<=90;i++){
    const t=i/90*2*Math.PI,v=a===0?[Math.cos(t),0,Math.sin(t)]:[0,Math.cos(t),Math.sin(t)];
    const p=project(v);
    i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);
   }
   ctx.stroke();
  }
  const moon=project([0,0,0]);
  const moonRadius=11*zoom;
  const moonShade=ctx.createRadialGradient(moon.x-3,moon.y-4,1,moon.x,moon.y,moonRadius);
  moonShade.addColorStop(0,"#b3cbd7");moonShade.addColorStop(.65,"#627b8a");moonShade.addColorStop(1,"#263e54");
  ctx.beginPath();ctx.arc(moon.x,moon.y,moonRadius,0,Math.PI*2);ctx.fillStyle=moonShade;ctx.fill();
  if(!geometry){
   ctx.fillStyle="#91b2c5";ctx.font="10px system-ui";ctx.fillText("Loading JPL vectors…",9,121);
   return;
  }
  const vectors=[
   {name:"Sun",v:unit([geometry.sun.x,geometry.sun.y,geometry.sun.z]),color:"#f0c96d"},
   {name:"Earth",v:unit([geometry.earth.x,geometry.earth.y,geometry.earth.z]),color:"#63bef4"}
  ];
  vectors.sort((a,b)=>project(a.v).depth-project(b.v).depth);
  for(const marker of vectors){
   const end=project(marker.v);
   ctx.beginPath();ctx.moveTo(moon.x,moon.y);ctx.lineTo(end.x,end.y);
   ctx.strokeStyle=marker.color;ctx.lineWidth=1.9;ctx.stroke();
   ctx.beginPath();ctx.arc(end.x,end.y,5,0,Math.PI*2);ctx.fillStyle=marker.color;ctx.fill();
   ctx.font="600 10px system-ui";ctx.fillStyle="#dfecf4";
   ctx.fillText(marker.name,clamp(end.x+8,6,width-43),clamp(end.y+4,12,height-11));
  }
  ctx.fillStyle="#85a8bd";ctx.font="9px system-ui";ctx.fillText("Drag to rotate · Directions only",8,height-8);
 };
 const down=e=>{canvas.setPointerCapture(e.pointerId);press={x:e.clientX,y:e.clientY,yaw,pitch};};
 const move=e=>{if(!press)return;yaw=press.yaw+(e.clientX-press.x)*.012;
  pitch=clamp(press.pitch+(e.clientY-press.y)*.012,-1.4,1.4);draw();};
 canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);
 canvas.addEventListener("pointerup",()=>{press=null;});canvas.addEventListener("pointercancel",()=>{press=null;});
 canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=clamp(zoom*Math.exp(-e.deltaY*.002),.7,1.5);draw();},{passive:false});
 canvas.tabIndex=0;canvas.setAttribute("aria-label","Rotatable 3D Moon-fixed directions to Sun and Earth, not to scale");
 canvas.addEventListener("keydown",e=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
  e.preventDefault();
  if(e.key==="ArrowLeft")yaw-=.15;if(e.key==="ArrowRight")yaw+=.15;
  if(e.key==="ArrowUp")pitch=clamp(pitch-.15,-1.4,1.4);
  if(e.key==="ArrowDown")pitch=clamp(pitch+.15,-1.4,1.4);draw();});
 draw();
 return {update(next){geometry=next;draw();},
  reset(){yaw=.48;pitch=-.33;zoom=1;draw();},destroy(){disposed=true;}};
}
