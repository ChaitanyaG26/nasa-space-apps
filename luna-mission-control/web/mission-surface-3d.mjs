/**
 * Rotatable terrain views for mission animations.
 * Earth: Mapzen/AWS public Terrarium elevation tile (SRTM/USGS/other mixed sources),
 * https://www.mapzen.com/blog/terrain-tile-service/
 * Moon: NASA LOLA 20-meter polar DEM if available, sampled into a site mesh.
 * No elevation data -> unknown/flat reference plane; NEVER invented mountains.
 * Motion poses belong to the separately labeled kinematic demonstration.
 */
import {destination} from "./lola-global.mjs";
import {samplePolarHeightKm} from "./lola-polar-detail.mjs";
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const LAUNCH_RANGE_COORDS={
 ksc:{lat:28.627,lon:-80.621,name:"Kennedy Space Center (reference range)"},
 ccsfs:{lat:28.563,lon:-80.577,name:"Cape Canaveral Space Force Station"},
 vandenberg:{lat:34.633,lon:-120.611,name:"Vandenberg Space Force Base"}
};
export function decodeTerrariumRGB(r,g,b){return r*256+g+b/256-32768;}
export function mercatorTile(lat,lon,z=13){
 const phi=lat*Math.PI/180,n=2**z;
 const x=(lon+180)/360*n,y=(1-Math.asinh(Math.tan(phi))/Math.PI)/2*n;
 return {x:Math.floor(x),y:Math.floor(y),fractionX:x%1,fractionY:y%1,z};
}
export async function loadEarthSiteGrid(siteId,{size=21,footprintM=600}={}){
 const loc=LAUNCH_RANGE_COORDS[siteId];if(!loc)return null;
 if(typeof Image==="undefined"||typeof document==="undefined")return null;
 const tile=mercatorTile(loc.lat,loc.lon),url=
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/"+tile.z+"/"+tile.x+"/"+tile.y+".png";
 const image=new Image();image.crossOrigin="anonymous";image.decoding="async";
 const loaded=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error("Terrain tile timed out")),7500);
  image.onload=()=>{clearTimeout(timer);resolve();};
  image.onerror=()=>{clearTimeout(timer);reject(new Error("Public DEM tile unavailable"));};
 });
 image.src=url;await loaded;
 const off=document.createElement("canvas");off.width=256;off.height=256;
 const ctx=off.getContext("2d",{willReadFrequently:true});
 ctx.drawImage(image,0,0,256,256);
 const pixels=ctx.getImageData(0,0,256,256).data;
 const at=(u,v)=>{
  const x=clamp(Math.round(u),0,255),y=clamp(Math.round(v),0,255),i=(y*256+x)*4;
  if(pixels[i+3]<220)return null;
  return decodeTerrariumRGB(pixels[i],pixels[i+1],pixels[i+2]);
 };
 const worldPixelM=Math.cos(loc.lat*Math.PI/180)*2*Math.PI*6378137/(2**tile.z*256);
 const rows=[];
 for(let j=0;j<size;j++){
  const row=[];
  for(let i=0;i<size;i++){
   const e=(i/(size-1)-.5)*footprintM,n=(.5-j/(size-1))*footprintM;
   const u=tile.fractionX*256+e/worldPixelM,v=tile.fractionY*256-n/worldPixelM;
   row.push({e,n,h:u>=0&&u<256&&v>=0&&v<256?at(u,v):null});
  }
  rows.push(row);
 }
 return {rows,center:rows[Math.floor(size/2)][Math.floor(size/2)]?.h??null,
  siteId,source:"Mapzen / AWS open elevation tiles · mixed SRTM/USGS source",footprintM,
  resolutionM:worldPixelM,coverage:rows.flat().filter(v=>Number.isFinite(v.h)).length/size**2};
}
export function loadMoonSiteGrid(patch,lat,lon,{size=23,footprintM=440}={}){
 if(!patch||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
 const rows=[];
 for(let j=0;j<size;j++){
  const row=[];
  for(let i=0;i<size;i++){
   const e=(i/(size-1)-.5)*footprintM,n=(.5-j/(size-1))*footprintM;
   const [a,b]=destination(lat,lon,(Math.atan2(e,n)*180/Math.PI+360)%360,Math.hypot(e,n)/1000);
   const h=samplePolarHeightKm(patch,a,b);
   row.push({e,n,h:h===null?null:h*1000});
  }
  rows.push(row);
 }
 const valid=rows.flat().filter(v=>Number.isFinite(v.h));
 return {rows,center:rows[Math.floor(size/2)][Math.floor(size/2)]?.h??null,
  source:"NASA LOLA 20 m polar DEM",footprintM,resolutionM:20,coverage:valid.length/size**2};
}
export function projectTerrainPoint(e,n,z,camera={yaw:.6,pitch:.65,zoom:1},width=600,height=278){
 const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
 const east=cy*e-sy*n,north=sy*e+cy*n;
 const scale=.63*(camera.zoom||1);
 return {x:width/2+east*scale,y:height*.82+(north*sp-z*cp)*scale,
  depth:north*cp+z*sp};
}
function polygon(ctx,points,fill,stroke=null){
 ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
 ctx.closePath();ctx.fillStyle=fill;ctx.fill();
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.3;ctx.stroke();}
}
function vehicleCylinder(ctx,{e=0,n=0,z=0,r=5,height=65,body="#e2edf5",camera}){
 const faces=[];
 for(let k=0;k<14;k++){
  const a=k*2*Math.PI/14,b=(k+1)*2*Math.PI/14;
  const pts=[projectTerrainPoint(e+r*Math.cos(a),n+r*Math.sin(a),z,camera),
   projectTerrainPoint(e+r*Math.cos(b),n+r*Math.sin(b),z,camera),
   projectTerrainPoint(e+r*Math.cos(b),n+r*Math.sin(b),z+height*.87,camera),
   projectTerrainPoint(e+r*Math.cos(a),n+r*Math.sin(a),z+height*.87,camera)];
  const light=.52+.48*Math.max(0,Math.cos((a+b)/2-.5));
  faces.push({pts,depth:pts.reduce((x,p)=>x+p.depth,0)/4,light});
 }
 faces.sort((a,b)=>b.depth-a.depth);
 for(const face of faces){
  ctx.save();ctx.globalAlpha=.84+.16*face.light;polygon(ctx,face.pts,body,"#48637633");ctx.restore();
 }
 const top=projectTerrainPoint(e,n,z+height,camera),shoulder=projectTerrainPoint(e,n,z+height*.87,camera);
 ctx.beginPath();ctx.moveTo(top.x,top.y);
 ctx.lineTo(shoulder.x-r*.63,shoulder.y);ctx.lineTo(shoulder.x+r*.63,shoulder.y);
 ctx.closePath();ctx.fillStyle=body;ctx.fill();
}
function landerSolid(ctx,{z=0,camera,body="#bfcddd",flame=false}){
 const half=15,top=15,base=4;
 const p=(e,n,z0)=>projectTerrainPoint(e,n,z0,camera);
 const a=p(-half,-half,z+base),b=p(half,-half,z+base),
  c=p(half,half,z+base),d=p(-half,half,z+base),
  A=p(-half,-half,z+top),B=p(half,-half,z+top),C=p(half,half,z+top),D=p(-half,half,z+top);
 polygon(ctx,[d,c,C,D],"#8193a8");polygon(ctx,[b,c,C,B],"#c6d4de");polygon(ctx,[a,b,B,A],body);
 polygon(ctx,[A,B,C,D],"#dce6ed");
 // Solar panels and antennas: drawn as three-dimensional components.
 polygon(ctx,[p(-40,-15,z+7),p(-17,-15,z+7),p(-17,15,z+7),p(-40,15,z+7)],"#286ea2");
 polygon(ctx,[p(17,-15,z+7),p(40,-15,z+7),p(40,15,z+7),p(17,15,z+7)],"#286ea2");
 ctx.strokeStyle="#e2ebf3";ctx.lineWidth=1.8;
 for(const [e,n] of [[-21,-21],[21,-21],[-21,21],[21,21]]){
  const start=p(e*.7,n*.7,z+8),end=p(e,n,z);
  ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();
 }
 const mast=p(0,0,z+34),root=p(0,0,z+top);ctx.beginPath();ctx.moveTo(root.x,root.y);
 ctx.lineTo(mast.x,mast.y);ctx.stroke();ctx.fillStyle="#e6f4fb";
 ctx.beginPath();ctx.arc(mast.x,mast.y,2,0,Math.PI*2);ctx.fill();
 if(flame){
  const start=p(0,0,z+1),tail=p(0,0,Math.max(-12,z-22));
  ctx.beginPath();ctx.moveTo(start.x-3,start.y);ctx.lineTo(tail.x,tail.y);
  ctx.lineTo(start.x+3,start.y);ctx.closePath();ctx.fillStyle="#f4bd57";ctx.fill();
 }
}
export function drawMissionSurface3D(ctx,{grid=null,kind="launch",camera={yaw:.6,pitch:.65,zoom:1},
 altitudeM=0,vehicle=null,lander=null,progress=0,width=600,height=278}={}){
 const bg=ctx.createLinearGradient(0,0,width,height);
 bg.addColorStop(0,kind==="launch"?"#183e59":"#050e19");
 bg.addColorStop(1,kind==="launch"?"#759aaf":"#253449");
 ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
 const cells=grid?.rows,center=Number.isFinite(grid?.center)?grid.center:0;
 const size=cells?.length||17;
 const footprint=grid?.footprintM||440;
 const get=(j,i)=>{
  if(cells)return cells[j]?.[i]||null;
  return {e:(i/(size-1)-.5)*footprint,n:(.5-j/(size-1))*footprint,h:0};
 };
 const ground=[];
 for(let j=0;j<size-1;j++)for(let i=0;i<size-1;i++){
  const pts=[get(j,i),get(j,i+1),get(j+1,i+1),get(j+1,i)];
  if(pts.some(p=>!p||!Number.isFinite(p.h)))continue;
  const p=pts.map(t=>projectTerrainPoint(t.e,t.n,(t.h-center)*1.0,camera,width,height));
  const dhx=pts[1].h-pts[0].h,dhy=pts[3].h-pts[0].h;
  const light=clamp(.73+.25*(dhx-dhy)/Math.max(1,footprint/(size-1)),.45,1.0);
  const shade=Math.round((kind==="launch"?106:126)*light);
  const fill=kind==="launch"?"rgb("+Math.round(shade*.75)+","+shade+","+Math.round(shade*.84)+")":
   "rgb("+shade+","+Math.round(shade*1.02)+","+Math.round(shade*1.09)+")";
  ground.push({p,depth:p.reduce((sum,v)=>sum+v.depth,0)/p.length,fill});
 }
 ground.sort((a,b)=>b.depth-a.depth);
 for(const cell of ground)polygon(ctx,cell.p,cell.fill);
 // Real DEM missing: neutral reference grid only, never fictional local hills.
 if(!grid){
  ctx.strokeStyle="#8ba7ba50";ctx.lineWidth=.8;
  for(let j=0;j<10;j++){
   const v=(j/9-.5)*footprint;
   let a=projectTerrainPoint(v,-footprint/2,0,camera,width,height),
    b=projectTerrainPoint(v,footprint/2,0,camera,width,height);
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   a=projectTerrainPoint(-footprint/2,v,0,camera,width,height);
   b=projectTerrainPoint(footprint/2,v,0,camera,width,height);
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
 }
 if(kind==="launch"){
  // Ascent altitude compressed above 300 m; no fake high-altitude terrain.
  const z=190*(1-Math.exp(-Math.max(0,altitudeM)/1800));
  const center=projectTerrainPoint(0,0,0,camera,width,height);
  ctx.beginPath();ctx.ellipse(center.x,center.y,18,6,0,0,Math.PI*2);
  ctx.fillStyle="#111d2890";ctx.fill();
  const rocket=vehicle||{heightM:70,diameterM:3.7,paint:"#e0e6ec"};
  if(rocket.boosters){
   for(const off of [-1,1])vehicleCylinder(ctx,{e:off*(rocket.diameterM*1.7),n:0,z,
    r:rocket.diameterM*.32,height:rocket.heightM*.83,body:"#9babb7",camera});
  }
  vehicleCylinder(ctx,{z,r:Math.max(2,rocket.diameterM/2),
   height:rocket.heightM,body:rocket.paint,camera});
  if(progress>.04&&progress<.99){
   const tip=projectTerrainPoint(0,0,z-28,camera,width,height);
   const tail=projectTerrainPoint(0,0,z,camera,width,height);
   ctx.beginPath();ctx.moveTo(tail.x-5,tail.y);ctx.lineTo(tip.x,tip.y);
   ctx.lineTo(tail.x+5,tail.y);ctx.closePath();ctx.fillStyle="#ffca67";ctx.fill();
  }
 }else{
  // The terminal 180 m is compressed solely for visibility; numerical
  // altitude and vertical speed are provided by the physical kinematic model.
  const z=120*clamp(altitudeM/180,0,1);
  const target=projectTerrainPoint(0,0,0,camera,width,height);
  ctx.beginPath();ctx.arc(target.x,target.y,4,0,Math.PI*2);
  ctx.strokeStyle="#e5ca76";ctx.lineWidth=1.6;ctx.stroke();
  landerSolid(ctx,{z,camera,body:lander?.body||"#c8d5e0",flame:progress>.01&&progress<.99});
 }
}
