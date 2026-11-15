/**
 * Rotatable terrain views for mission animations.
 * Earth: Mapzen/AWS public Terrarium elevation tile (SRTM/USGS/other mixed sources),
 * https://www.mapzen.com/blog/terrain-tile-service/
 * Moon: NASA LOLA 20-meter polar DEM if available, sampled into a site mesh.
 * No elevation data -> unknown/flat reference plane; NEVER invented mountains.
 * Motion poses belong to the separately labeled kinematic demonstration.
 */
import {destination,elevationGlobalKm} from "./lola-global.mjs";
import {samplePolarHeightKm} from "./lola-polar-detail.mjs";
import {sunENU,sunLight,terrainNormal,sunShadowOffset} from "./solar-geometry.mjs";
import {loadUSGS3DEPGrid} from "./usgs-3dep.mjs";
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
const earthGridCache=new Map();
async function getTerrariumTile(z,x,y){
 const image=new Image();image.crossOrigin="anonymous";image.decoding="async";
 const loaded=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error("Terrain tile timed out")),6500);
  image.onload=()=>{clearTimeout(timer);resolve();};
  image.onerror=()=>{clearTimeout(timer);reject(new Error("Public tile unavailable"));};
 });
 image.src="https://s3.amazonaws.com/elevation-tiles-prod/terrarium/"+z+"/"+x+"/"+y+".png";
 await loaded;
 const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
 const ctx=canvas.getContext("2d",{willReadFrequently:true});
 if(!ctx)throw Error("Canvas image decoder unavailable");
 ctx.drawImage(image,0,0,256,256);
 return ctx.getImageData(0,0,256,256).data;
}
async function getEarthGridAtZoom(siteId,{size,footprintM},z){
 const loc=LAUNCH_RANGE_COORDS[siteId],tile=mercatorTile(loc.lat,loc.lon,z);
 const pixelM=Math.cos(loc.lat*Math.PI/180)*2*Math.PI*6378137/(2**z*256);
 const half=footprintM/(2*pixelM),originX=tile.fractionX*256,originY=tile.fractionY*256;
 const xs=[Math.floor((originX-half)/256),Math.floor((originX+half)/256)];
 const ys=[Math.floor((originY-half)/256),Math.floor((originY+half)/256)];
 const wanted=[];
 for(let j=ys[0];j<=ys[1];j++)for(let i=xs[0];i<=xs[1];i++)wanted.push([i,j]);
 // A single 256px tile silently returned null data at a tile boundary.
 // Here *all* crossing tiles are fetched and sampled bilinearly.
 if(wanted.length>9)throw Error("Too many terrain tiles for requested extent");
 const tiles=new Map(await Promise.all(wanted.map(async ([x,y])=>
  [x+","+y,await getTerrariumTile(z,tile.x+x,tile.y+y)])));
 const elevation=(x,y)=>{
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const get=(xx,yy)=>{
   const tx=Math.floor(xx/256),ty=Math.floor(yy/256);
   const buffer=tiles.get(tx+","+ty);
   if(!buffer)return null;
   const col=((xx%256)+256)%256,row=((yy%256)+256)%256;
   const i=(row*256+col)*4;
   return buffer[i+3]<220?null:decodeTerrariumRGB(buffer[i],buffer[i+1],buffer[i+2]);
  };
  const values=[get(ix,iy),get(ix+1,iy),get(ix,iy+1),get(ix+1,iy+1)];
  if(values.some(v=>v===null))return null;
  return values[0]*(1-fx)*(1-fy)+values[1]*fx*(1-fy)+
   values[2]*(1-fx)*fy+values[3]*fx*fy;
 };
 const rows=[];
 for(let j=0;j<size;j++){
  const row=[];
  for(let i=0;i<size;i++){
   const e=(i/(size-1)-.5)*footprintM,n=(.5-j/(size-1))*footprintM;
   row.push({e,n,h:elevation(originX+e/pixelM,originY-n/pixelM)});
  }
  rows.push(row);
 }
 const coverage=rows.flat().filter(v=>Number.isFinite(v.h)).length/(size*size);
 return {rows,center:rows[Math.floor(size/2)][Math.floor(size/2)]?.h??null,
  siteId,source:"Mapzen / AWS open Terrarium elevation tiles, mixed sources",footprintM,
  resolutionM:pixelM,sourceResolutionKnown:false,coverage,tileZoom:z};
}
export async function loadEarthSiteGrid(siteId,{size=41,footprintM=600}={}){
 if(!LAUNCH_RANGE_COORDS[siteId]||typeof Image==="undefined"||typeof document==="undefined")return null;
 const key=[siteId,size,footprintM].join(":");
 if(!earthGridCache.has(key)){
  const promise=(async()=>{
   // Prefer USGS 3DEP's best-available DEM for these U.S. orbital ranges.
   // Its actual native precision varies by site. CORS or unsupported TIFF
   // compression may fail: safely use pre-existing public Terrarium tiles.
   try{
    const usgs=await loadUSGS3DEPGrid(siteId,LAUNCH_RANGE_COORDS[siteId],
     {size:65,footprintM,timeoutMs:4500});
    if(usgs&&usgs.coverage>=.85)return usgs;
   }catch{/* Optional 3DEP service unavailable. */}
   // z15 exposes finer output sampling, NOT guaranteed native DEM detail.
   for(const z of [15,14,13]){
    try{
     const grid=await getEarthGridAtZoom(siteId,{size,footprintM},z);
     if(grid.coverage>=.75)return grid;
    }catch{/* Missing tile/CORS: retry a lower zoom level. */}
   }
   return null;
  })();
  earthGridCache.set(key,promise);
  promise.catch(()=>earthGridCache.delete(key));
 }
 return earthGridCache.get(key);
}
export function loadMoonSiteGrid(patch,lat,lon,{size=33,footprintM=640,global=null}={}){
 if(!patch&&!global)return null;
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
 // A 500 m square around the target cannot be resolved by 8 ppd LOLA.
 // Only display coarse regional relief when a 20 m local patch is absent.
 const detailed=Boolean(patch);
 if(!detailed){footprintM=40000;size=33;}
 const rows=[];
 for(let j=0;j<size;j++){
  const row=[];
  for(let i=0;i<size;i++){
   const e=(i/(size-1)-.5)*footprintM,n=(.5-j/(size-1))*footprintM;
   const [a,b]=destination(lat,lon,(Math.atan2(e,n)*180/Math.PI+360)%360,Math.hypot(e,n)/1000);
   const h=detailed?samplePolarHeightKm(patch,a,b):elevationGlobalKm(global,a,b);
   row.push({e,n,h:h===null?null:h*(detailed?1000:1000)});
  }
  rows.push(row);
 }
 const valid=rows.flat().filter(v=>Number.isFinite(v.h));
 return {rows,center:rows[Math.floor(size/2)][Math.floor(size/2)]?.h??null,
  source:detailed?"NASA LOLA 20 m polar DEM":"NASA LOLA global 8 pixels/degree (regional)",
  detail:detailed,footprintM,resolutionM:detailed?20:3800,
  sourceResolutionKnown:true,coverage:valid.length/size**2};
}
export function projectTerrainPoint(e,n,z,camera={yaw:.6,pitch:.65,zoom:1},width=600,height=278){
 const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
 const east=cy*e-sy*n,north=sy*e+cy*n;
 const scale=.63*(camera.zoom||1)*(camera.worldScale||1);
 return {x:width/2+east*scale,y:height*.82+(north*sp-z*cp)*scale,
  depth:north*cp+z*sp};
}

function polygon(ctx,points,fill,stroke=null){
 ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
 ctx.closePath();ctx.fillStyle=fill;ctx.fill();
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.35;ctx.stroke();}
}
function shadeColor(hex,brightness){
 const m=/^#([a-f0-9]{6})$/i.exec(hex);
 if(!m)return hex;
 const value=m[1],f=clamp(brightness,.08,1.1);
 const channels=[0,2,4].map(i=>Math.min(255,Math.round(parseInt(value.slice(i,i+2),16)*f)));
 return "rgb("+channels.join(",")+")";
}
// Sun glyph is a directional visual cue, not a physically sized Sun.
// Elevation and azimuth come from UTC JPL reference geometry.
function drawSkySun(ctx,sun,camera,width,height){
 if(!sun||sun.elevationDeg<-.8)return;
 const d=sunENU(sun),cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw);
 const side=cy*d.e-sy*d.n,forward=sy*d.e+cy*d.n;
 const x=clamp(width/2+side*width*.36,24,width-24);
 const y=clamp(height*.25-(d.u*.26+forward*.055)*height,16,height*.63);
 const glow=ctx.createRadialGradient(x,y,0,x,y,32);
 glow.addColorStop(0,"#fff4cbaa");glow.addColorStop(.22,"#ffe08a69");glow.addColorStop(1,"#f9cd6300");
 ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,32,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#fff6d5";ctx.beginPath();ctx.arc(x,y,5.7,0,Math.PI*2);ctx.fill();
}
function drawShadow(ctx,sun,camera,footprint,heightM,width,height){
 const position=sunShadowOffset(heightM,sun,footprint*.82);
 if(!position)return;
 const source=projectTerrainPoint(0,0,.35,camera,width,height);
 const tip=projectTerrainPoint(position.e,position.n,.35,camera,width,height);
 const dx=tip.x-source.x,dy=tip.y-source.y,len=Math.hypot(dx,dy);
 if(len<2)return;
 const nx=-dy/len,ny=dx/len;
 ctx.beginPath();ctx.moveTo(source.x+nx*6,source.y+ny*6);
 ctx.lineTo(tip.x+nx*8,tip.y+ny*8);
 ctx.quadraticCurveTo(tip.x,tip.y,tip.x-nx*8,tip.y-ny*8);
 ctx.lineTo(source.x-nx*6,source.y-ny*6);
 ctx.closePath();ctx.fillStyle="#02071172";ctx.fill();
}
function cylinder(ctx,{e=0,n=0,z=0,r=5,height=65,body="#e2edf5",camera,sun=null}){
 const faces=[];
 for(let k=0;k<18;k++){
  const a=k*2*Math.PI/18,b=(k+1)*2*Math.PI/18;
  const vertices=[projectTerrainPoint(e+r*Math.cos(a),n+r*Math.sin(a),z,camera),
   projectTerrainPoint(e+r*Math.cos(b),n+r*Math.sin(b),z,camera),
   projectTerrainPoint(e+r*Math.cos(b),n+r*Math.sin(b),z+height*.88,camera),
   projectTerrainPoint(e+r*Math.cos(a),n+r*Math.sin(a),z+height*.88,camera)];
  const mid=(a+b)/2;
  faces.push({vertices,depth:vertices.reduce((t,p)=>t+p.depth,0)/4,
   light:sunLight({e:Math.cos(mid),n:Math.sin(mid),u:0},sun,{ambient:.25,diffuse:.75})});
 }
 faces.sort((a,b)=>b.depth-a.depth);
 for(const face of faces)polygon(ctx,face.vertices,shadeColor(body,face.light),"#38546e3c");
 const peak=projectTerrainPoint(e,n,z+height,camera),shoulder=projectTerrainPoint(e,n,z+height*.88,camera);
 ctx.beginPath();ctx.moveTo(peak.x,peak.y);
 ctx.lineTo(shoulder.x-r*.58,shoulder.y);ctx.lineTo(shoulder.x+r*.58,shoulder.y);
 ctx.closePath();
 ctx.fillStyle=shadeColor(body,sunLight({e:0,n:0,u:1},sun,{ambient:.25,diffuse:.75}));ctx.fill();
}
function landerSolid(ctx,{z=0,camera,scale=1,body="#bfcddd",flame=false,sun=null}){
 const half=15,top=15,base=4;
 const p=(e,n,h)=>projectTerrainPoint(e*scale,n*scale,h*scale,camera);
 const a=p(-half,-half,z+base),b=p(half,-half,z+base),
  c=p(half,half,z+base),d=p(-half,half,z+base),
  A=p(-half,-half,z+top),B=p(half,-half,z+top),C=p(half,half,z+top),D=p(-half,half,z+top);
 const lit=(color,n)=>shadeColor(color,sunLight(n,sun,{ambient:.18,diffuse:.82}));
 polygon(ctx,[d,c,C,D],lit("#8193a8",{e:0,n:1,u:0}));
 polygon(ctx,[b,c,C,B],lit("#c6d4de",{e:1,n:0,u:0}));
 polygon(ctx,[a,b,B,A],lit(body,{e:0,n:-1,u:0}));
 polygon(ctx,[A,B,C,D],lit("#dce6ed",{e:0,n:0,u:1}));
 const panelColor=lit("#286ea2",{e:0,n:0,u:1});
 polygon(ctx,[p(-40,-15,z+7),p(-17,-15,z+7),p(-17,15,z+7),p(-40,15,z+7)],panelColor);
 polygon(ctx,[p(17,-15,z+7),p(40,-15,z+7),p(40,15,z+7),p(17,15,z+7)],panelColor);
 ctx.strokeStyle="#dcebf3";ctx.lineWidth=1.8;
 for(const [e,n] of [[-21,-21],[21,-21],[-21,21],[21,21]]){
  const leg=p(e*.7,n*.7,z+8),ground=p(e,n,z);
  ctx.beginPath();ctx.moveTo(leg.x,leg.y);ctx.lineTo(ground.x,ground.y);ctx.stroke();
 }
 const mast=p(0,0,z+34),root=p(0,0,z+top);
 ctx.beginPath();ctx.moveTo(root.x,root.y);ctx.lineTo(mast.x,mast.y);ctx.stroke();
 ctx.fillStyle="#f1f5fa";ctx.beginPath();ctx.arc(mast.x,mast.y,2,0,Math.PI*2);ctx.fill();
 if(flame){
  const from=p(0,0,z+1),to=p(0,0,Math.max(-12,z-22));
  ctx.beginPath();ctx.moveTo(from.x-3,from.y);ctx.lineTo(to.x,to.y);
  ctx.lineTo(from.x+3,from.y);ctx.closePath();ctx.fillStyle="#ffd075";ctx.fill();
 }
}
export function drawMissionSurface3D(ctx,{grid=null,kind="launch",camera={yaw:.6,pitch:.65,zoom:1},
 altitudeM=0,vehicle=null,lander=null,progress=0,width=600,height=278,sun=null}={}){
 const validSun=Number.isFinite(sun?.azimuthDeg)&&Number.isFinite(sun?.elevationDeg)?sun:null;
 const day=Boolean(validSun&&validSun.elevationDeg>0);
 const twilight=Boolean(validSun&&validSun.elevationDeg>-12);
 const bg=ctx.createLinearGradient(0,0,width,height);
 bg.addColorStop(0,kind==="landing"?"#030913":day?"#164e79":twilight?"#142840":"#05101f");
 bg.addColorStop(1,kind==="landing"?"#101c30":day?"#5c96b3":twilight?"#44324a":"#14243a");
 ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
 drawSkySun(ctx,validSun,camera,width,height);
 const cells=grid?.rows,center=Number.isFinite(grid?.center)?grid.center:0;
 const size=cells?.length||17,footprint=grid?.footprintM||440;
 // Region-scale fallback exaggerates spacecraft size, never DEM precision.
 const viewCamera={...camera,worldScale:Math.min(1,440/footprint)};
 const terrainExaggeration=grid?.detail===false?4.5:kind==="launch"?2.0:1.25;
 const exaggeration=Math.max(1,footprint/440);
 const get=(j,i)=>{
  if(cells)return cells[j]?.[i]||null;
  return {e:(i/(size-1)-.5)*footprint,n:(.5-j/(size-1))*footprint,h:0};
 };
 const ground=[];
 for(let j=0;j<size-1;j++)for(let i=0;i<size-1;i++){
  const cells=[get(j,i),get(j,i+1),get(j+1,i+1),get(j+1,i)];
  if(cells.some(p=>!p||!Number.isFinite(p.h)))continue;
  const vertices=cells.map(p=>projectTerrainPoint(p.e,p.n,
   (p.h-center)*terrainExaggeration,viewCamera,width,height));
  const normal=terrainNormal(cells);
  const intensity=sunLight(normal,validSun,
   {ambient:kind==="landing"?.16:.30,diffuse:kind==="landing"?.84:.70});
  const base=Math.round((kind==="launch"?123:158)*intensity);
  const fill=kind==="launch"?
   "rgb("+Math.round(base*.75)+","+base+","+Math.round(base*.91)+")":
   "rgb("+base+","+Math.round(base*.99)+","+Math.round(base*1.06)+")";
  ground.push({vertices,depth:vertices.reduce((acc,p)=>acc+p.depth,0)/4,fill});
 }
 ground.sort((a,b)=>b.depth-a.depth);
 for(const cell of ground)polygon(ctx,cell.vertices,cell.fill);
 // The grid is a neutral placeholder only when no terrain measurements exist.
 if(!grid){
  ctx.strokeStyle="#8ba7ba53";ctx.lineWidth=.8;
  for(let j=0;j<9;j++){
   const u=(j/8-.5)*footprint;
   for(const points of [
    [projectTerrainPoint(u,-footprint/2,0,viewCamera,width,height),
     projectTerrainPoint(u,footprint/2,0,viewCamera,width,height)],
    [projectTerrainPoint(-footprint/2,u,0,viewCamera,width,height),
     projectTerrainPoint(footprint/2,u,0,viewCamera,width,height)]
   ]){
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    ctx.lineTo(points[1].x,points[1].y);ctx.stroke();
   }
  }
 }
 if(kind==="launch"){
  // Ascent height is compressed for viewability, not a flight-path solver.
  const z=190*(1-Math.exp(-Math.max(0,altitudeM)/1800));
  const rocket=vehicle||{heightM:70,diameterM:3.7,paint:"#e0e6ec"};
  drawShadow(ctx,validSun,viewCamera,footprint,z+rocket.heightM,width,height);
  if(rocket.boosters)for(const off of [-1,1])
   cylinder(ctx,{e:off*(rocket.diameterM*1.7),n:0,z,r:rocket.diameterM*.32,
    height:rocket.heightM*.83,body:"#9babb7",camera:viewCamera,sun:validSun});
  cylinder(ctx,{z,r:Math.max(2,rocket.diameterM/2),
   height:rocket.heightM,body:rocket.paint,camera:viewCamera,sun:validSun});
  if(progress>.04&&progress<.99){
   const tip=projectTerrainPoint(0,0,z-28,viewCamera,width,height);
   const tail=projectTerrainPoint(0,0,z,viewCamera,width,height);
   ctx.beginPath();ctx.moveTo(tail.x-5,tail.y);ctx.lineTo(tip.x,tip.y);
   ctx.lineTo(tail.x+5,tail.y);ctx.closePath();ctx.fillStyle="#ffca67";ctx.fill();
  }
 }else{
  const z=120*clamp(altitudeM/180,0,1);
  drawShadow(ctx,validSun,viewCamera,footprint,z+15*exaggeration,width,height);
  const target=projectTerrainPoint(0,0,0,viewCamera,width,height);
  ctx.beginPath();ctx.arc(target.x,target.y,4,0,Math.PI*2);
  ctx.strokeStyle="#d8bd69";ctx.lineWidth=1.6;ctx.stroke();
  landerSolid(ctx,{z,camera:viewCamera,scale:exaggeration,
   body:lander?.body||"#c8d5e0",flame:progress>.01&&progress<.99,sun:validSun});
 }
}
