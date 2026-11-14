/** Interactive 3D elevation mesh of measured NASA LOLA terrain.
 * Real 20-m patch when available; otherwise 8-ppd global region.
 * SEISMIC EVIDENCE is NOT a map of safe/unsafe areas:
 * sparse Apollo seismometers and uncertain polar epicenters prohibit
 * site-specific seismic activity or hazard ratings.
 *
 * NASA sources:
 * https://pgda.gsfc.nasa.gov/products/90
 * https://pds-geosciences.wustl.edu/missions/apollo/seismic_event_catalog.htm
 * https://www.nasa.gov/solar-system/moon/shrinking-moon-causing-moonquakes-and-faults-near-lunar-south-pole/
 */
import {destination,elevationGlobalKm} from "./lola-global.mjs";
import {localPatchXY} from "./lola-polar-detail.mjs";
const clamp=(a,min,max)=>Math.max(min,Math.min(max,a));
const L=512,NO=-32768;
const palette={green:"#77ae92",amber:"#e5b45c",red:"#d9786a",missing:"#8997a5"};
export function localSampleKm(patch,eastM,northM){
 if(!patch)return null;
 const x=(eastM+5120)/20-.5,y=(5120-northM)/20-.5;
 const x0=Math.floor(x),y0=Math.floor(y);
 if(x0<0||x0>=L-1||y0<0||y0>=L-1)return null;
 const fx=x-x0,fy=y-y0;
 const at=(i,j)=>patch.view.getInt16((j*L+i)*2,true);
 const z=[at(x0,y0),at(x0+1,y0),at(x0,y0+1),at(x0+1,y0+1)];
 if(z.includes(NO))return null;
 return ((1-fx)*(1-fy)*z[0]+fx*(1-fy)*z[1]+(1-fx)*fy*z[2]+fx*fy*z[3])/1000;
}
export function seismicEvidence(latitude,longitude){
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)
   throw Error("Invalid selected lunar site");
 const southPole=latitude<=-80;
 return {classification:"UNASSESSED — DO NOT INFER SAFETY",hasSiteRiskEstimate:false,
  historicalCatalog:"NASA PDS Apollo Passive Seismic Experiment Expanded Event Catalog",
  mapColor:"#8997a5",
  researchConcern:southPole?"NASA-funded research documents south-polar shallow moonquake and fault hazards, but the epicenter remains uncertain. No individual site hazard rating is available.":
    "Apollo-era lunar seismic observations do not support a site-specific hazard rating here.",
  source:"https://pds-geosciences.wustl.edu/missions/apollo/seismic_event_catalog.htm",
  polarStudy:"https://www.nasa.gov/solar-system/moon/shrinking-moon-causing-moonquakes-and-faults-near-lunar-south-pole/"};
}
export function slopeClass(deg){
 if(!Number.isFinite(deg))return "missing";
 return deg<8?"green":deg<15?"amber":"red";
}
export function buildTerrainMesh({latitude,longitude,patch=null,global=null,size=55}){
 if(!(size>=9&&size<=95))throw Error("Invalid terrain mesh size");
 const detailed=Boolean(patch);
 const spacingKm=detailed ? 0.02 : 4;
 const pxy=detailed?localPatchXY(patch.entry.latitude,patch.entry.longitude,latitude,longitude):null;
 const vertices=[];
 for(let y=0;y<size;y++){
  const row=[];
  for(let x=0;x<size;x++){
   const e=(x-(size-1)/2)*spacingKm,n=((size-1)/2-y)*spacingKm;
   let z;
   if(detailed)z=localSampleKm(patch,pxy[0]+e*1000,pxy[1]+n*1000);
   else if(global){
    const dist=Math.hypot(e,n),bearing=(Math.atan2(e,n)*180/Math.PI+360)%360;
    const [lat,lon]=destination(latitude,longitude,bearing,dist);
    z=elevationGlobalKm(global,lat,lon);
   }else z=null;
   row.push(z===null?null:{x:e,y:n,z});
  }
  vertices.push(row);
 }
 const good=vertices.flat().filter(Boolean),zMin=good.length?Math.min(...good.map(p=>p.z)):null;
 const zMax=good.length?Math.max(...good.map(p=>p.z)):null;
 const slopes=[];
 let green=0,amber=0,red=0,missing=0;
 for(let j=0;j<size-1;j++){
  const line=[];
  for(let i=0;i<size-1;i++){
   const c=[vertices[j][i],vertices[j+1][i],vertices[j][i+1],vertices[j+1][i+1]];
   if(c.some(v=>v===null)){line.push(null);missing++;continue;}
   const dx=(c[2].z+c[3].z-c[0].z-c[1].z)/(2*spacingKm);
   const dy=(c[0].z+c[2].z-c[1].z-c[3].z)/(2*spacingKm);
   const slope=Math.atan(Math.hypot(dx,dy))*180/Math.PI;
   line.push(slope);
   if(slopeClass(slope)==="green")green++;
   else if(slopeClass(slope)==="amber")amber++;
   else red++;
  }
  slopes.push(line);
 }
 return {latitude,longitude,vertices,slopes,size,spacingKm,source:detailed?"NASA LOLA 20-m DEM patch":"NASA LOLA global 8-ppd DEM",
  detail:detailed,range:{min:zMin,max:zMax},distribution:{green,amber,red,missing}};
}
const shade=(hex,f)=>{
 const v=hex.slice(1),cs=[0,2,4].map(i=>parseInt(v.slice(i,i+2),16));
 return "rgb("+cs.map(x=>Math.round(clamp(x*f,0,255))).join(",")+")";
};
export function initTerrain3D(container,{latitude,longitude,patch=null,global=null}){
 container.replaceChildren();
 const heading=document.createElement("div");heading.className="terrain-heading";
 const headingTitle=document.createElement("h3");headingTitle.textContent="3D lunar terrain explorer";
 const headingSub=document.createElement("small");
 headingSub.textContent="NASA LOLA measured elevation · rotatable DEM, not photographed street view";
 heading.append(headingTitle,headingSub);
 const view=document.createElement("div");view.className="terrain-controls";
 const layerLabel=document.createElement("label");layerLabel.textContent="Terrain layer";
 const select=document.createElement("select");select.setAttribute("aria-label","3D terrain layer");
 for(const [value,label] of [["slope","NASA LOLA elevation & slope"],["seismic","Seismic evidence (unassessed)"]]){
  const option=document.createElement("option");option.value=value;option.textContent=label;select.append(option);
 }
 layerLabel.append(select);
 const exaggerationLabel=document.createElement("label");exaggerationLabel.textContent="Vertical exaggeration";
 const exaggeration=document.createElement("input");exaggeration.type="range";exaggeration.min="1";exaggeration.max="15";exaggeration.step="1";exaggeration.value="6";exaggeration.setAttribute("aria-label","Vertical exaggeration");
 const numeric=document.createElement("span");numeric.textContent="6×";
 exaggerationLabel.append(exaggeration,numeric);
 const reset=document.createElement("button");reset.type="button";reset.textContent="Reset view";reset.className="terrain-reset";
 view.append(layerLabel,exaggerationLabel,reset);
 const canvas=document.createElement("canvas");canvas.className="terrain-3d-canvas";
 canvas.setAttribute("aria-label","Interactive rotatable three-dimensional NASA LOLA local topography; slope classes or unassessed seismic evidence");
 canvas.tabIndex=0;
 const status=document.createElement("div");status.className="terrain-status";
 const legend=document.createElement("div");legend.className="terrain-legend";
 const source=document.createElement("p");source.className="terrain-caption";
 const evidence=seismicEvidence(latitude,longitude);
 const mesh=buildTerrainMesh({latitude,longitude,patch,global});
 container.append(heading,view,canvas,legend,status,source);
 let yaw=.65,tilt=.63,zoom=1,active=false,lastX=0,lastY=0;
 let layer="slope",exag=6,frame=null,disposed=false;
 const update=()=>{
  if(disposed)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const width=Math.max(320,canvas.clientWidth||800),height=Math.max(220,canvas.clientHeight||380);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  const ctx=canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle="#f1f6f8";ctx.fillRect(0,0,width,height);
  if(mesh.range.min===null){
   ctx.fillStyle="#4e6776";ctx.font="15px system-ui";
   ctx.fillText("NASA elevation samples unavailable for this view",20,height/2);return;
  }
  const {size,vertices,slopes,spacingKm}=mesh;
  const span=(size-1)*spacingKm,scale=Math.min(width*.73,height*.92)/Math.max(.1,span)*zoom;
  const hRef=(mesh.range.min+mesh.range.max)/2;
  const angleC=Math.cos(yaw),angleS=Math.sin(yaw),tC=Math.cos(tilt),tS=Math.sin(tilt);
  const project=p=>{
   const xx=p.x*angleC-p.y*angleS,yy=p.x*angleS+p.y*angleC;
   const zz=(p.z-hRef)*exag;
   return {x:width*.5+xx*scale,y:height*.54+(yy*tS-zz*tC)*scale,depth:yy*tC+zz*tS};
  };
  const ps=vertices.map(row=>row.map(v=>v===null?null:project(v)));
  const polygons=[];
  for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){
   const p=[ps[y][x],ps[y][x+1],ps[y+1][x+1],ps[y+1][x]];
   if(p.some(v=>v===null))continue;
   const slope=slopes[y][x];
   const base=layer==="seismic"?evidence.mapColor:palette[slopeClass(slope)];
   const vx=vertices[y][x+1].z-vertices[y][x].z,vy=vertices[y+1][x].z-vertices[y][x].z;
   const light=clamp(0.92+0.11*(vx-vy)/Math.max(.001,spacingKm),.65,1.15);
   polygons.push({p,fill:shade(base,light),depth:p.reduce((s,v)=>s+v.depth,0)/4});
  }
  polygons.sort((a,b)=>b.depth-a.depth);
  for(const poly of polygons){
   const a=poly.p;ctx.beginPath();ctx.moveTo(a[0].x,a[0].y);
   for(let i=1;i<4;i++)ctx.lineTo(a[i].x,a[i].y);
   ctx.closePath();ctx.fillStyle=poly.fill;ctx.fill();
  }
  ctx.fillStyle="#182e3e";ctx.fillRect(15,15,260,31);
  ctx.fillStyle="#eef8fc";ctx.font="600 12px system-ui";
  ctx.fillText(mesh.detail?"20-m NASA LOLA / LOCAL TERRAIN":"8-PPD NASA LOLA / REGIONAL TERRAIN",26,35);
  ctx.fillStyle="#4b6675";ctx.font="12px system-ui";
  ctx.fillText("Drag to rotate  •  Scroll to zoom",17,height-15);
 };
 const draw=()=>{if(frame===null)frame=requestAnimationFrame(()=>{frame=null;update();});};
 const setLabels=()=>{
  if(layer==="slope"){
   legend.innerHTML='<span><i style="background:#77ae92"></i>Measured DEM slope &lt;8°</span>'+
    '<span><i style="background:#e5b45c"></i>8°–15°</span>'+
    '<span><i style="background:#d9786a"></i>≥15°</span>'+
    '<span><i style="background:#8997a5"></i>No data</span>';
  }else{
   legend.innerHTML='<span><i style="background:#8997a5"></i>Seismic severity UNKNOWN everywhere in this view</span>'+
    '<span class="terrain-seismic-caution">No site-specific event rate, shaking forecast or “safe” color is supported.</span>';
  }
  status.textContent=(mesh.detail?"NASA LOLA detailed site patch · 20 m pixels":
    "NASA LOLA regional terrain · ~3.8 km source pixels")+
    " · "+((mesh.size-1)*mesh.spacingKm).toFixed(mesh.detail?2:0)+" km wide"+
    (mesh.range.min===null?" · No valid elevation":' · height '+(mesh.range.min*1000).toFixed(0)+" to "+(mesh.range.max*1000).toFixed(0)+" m relative to lunar reference radius");
  source.textContent=layer==="seismic"?
   "SEISMIC EVIDENCE — "+evidence.researchConcern+
   " NASA PDS Apollo seismic catalog documents historical events, but event detection/location uncertainty prevents a credible local risk rating.":
   "Slope coloring is derived from NASA LOLA elevations; it is NOT a seismic activity map. 20-m pixels (or regional global cells) miss smaller hazards. Display is vertically exaggerated.";
 };
 const down=e=>{active=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);};
 const move=e=>{if(!active)return;yaw+=(e.clientX-lastX)*.008;tilt=clamp(tilt+(e.clientY-lastY)*.006,.1,1.45);lastX=e.clientX;lastY=e.clientY;draw();};
 const up=()=>{active=false;};
 const wheel=e=>{e.preventDefault();zoom=clamp(zoom*(e.deltaY>0?.9:1.1),.45,3.5);draw();};
 canvas.addEventListener("pointerdown",down);canvas.addEventListener("pointermove",move);
 canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",up);
 canvas.addEventListener("wheel",wheel,{passive:false});
 canvas.addEventListener("keydown",e=>{if(e.key==="ArrowLeft")yaw-=.1;else if(e.key==="ArrowRight")yaw+=.1;else if(e.key==="ArrowUp")tilt=Math.min(1.45,tilt+.1);else if(e.key==="ArrowDown")tilt=Math.max(.1,tilt-.1);else return;e.preventDefault();draw();});
 select.addEventListener("change",()=>{layer=select.value;setLabels();draw();});
 exaggeration.addEventListener("input",()=>{exag=Number(exaggeration.value);numeric.textContent=exag+"×";draw();});
 reset.addEventListener("click",()=>{yaw=.65;tilt=.63;zoom=1;exag=6;exaggeration.value="6";numeric.textContent="6×";draw();});
 const resize=typeof ResizeObserver!=="undefined"?new ResizeObserver(draw):null;
 if(resize)resize.observe(canvas);
 setLabels();draw();
 return {dispose(){disposed=true;resize?.disconnect();if(frame!==null)cancelAnimationFrame(frame);}};
}
