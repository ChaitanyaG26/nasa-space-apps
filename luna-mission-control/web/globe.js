import {HISTORIC_LANDING_SITES,LANDING_ORGANIZATIONS,siteVector,readableLandingTime} from "./landing-sites.mjs";
// NASA Lunar Reconnaissance Orbiter color mosaic (CGI Moon Kit), displayed on a globe.
// https://svs.gsfc.nasa.gov/4720/ . Visual reference, not LOLA terrain hazards.
export function initGlobe(canvas,onSelect) {
 const gl=canvas.getContext("webgl2",{antialias:true}) || canvas.getContext("webgl",{antialias:true});
 if(!gl){const ctx=canvas.getContext("2d");ctx.fillStyle="#425a69";ctx.fillRect(0,0,canvas.width,canvas.height);return {setSun(){},focus(){},setSite(){}}}
 const vs=gl.createShader(gl.VERTEX_SHADER);
 gl.shaderSource(vs,"attribute vec3 pos;uniform float yaw,pitch,aspect,zoom;varying vec3 normal;varying vec3 cameraNormal;void main(){float c=cos(yaw),s=sin(yaw),a=cos(pitch),b=sin(pitch);vec3 p=vec3(c*pos.x+s*pos.z,pos.y,-s*pos.x+c*pos.z);vec3 q=vec3(p.x,a*p.y-b*p.z,b*p.y+a*p.z);normal=pos;cameraNormal=q;gl_Position=vec4(q.x*zoom/aspect,q.y*zoom,q.z*.5,1.);}");
 gl.compileShader(vs);
 const fs=gl.createShader(gl.FRAGMENT_SHADER);
 gl.shaderSource(fs,"precision mediump float;\nvarying vec3 normal;\nvarying vec3 cameraNormal;\nuniform vec3 sun;\nuniform sampler2D moonColor;\nconst float PI = 3.141592653589793;\nvoid main() {\n  if (cameraNormal.z < 0.0) discard;\n  vec3 n=normalize(normal);\n  // NASA image is centered on longitude zero, north up.\n  // The image upload uses UNPACK_FLIP_Y_WEBGL=true.\n  float u=0.5+atan(n.x,n.z)/(2.0*PI);\n  float v=0.5+asin(clamp(n.y,-1.0,1.0))/PI;\n  vec3 albedo=texture2D(moonColor,vec2(u,v)).rgb;\n  float incidence=max(dot(n,normalize(sun)),0.0);\n  // Astronomical terminator still follows Sun geometry; fill light is display-only, not illumination model.\n  float brightness=0.29+0.71*sqrt(incidence);\n  gl_FragColor=vec4(albedo*brightness,1.0);\n}");
 gl.compileShader(fs);const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);gl.useProgram(prog);
 const vertices=[],indexes=[],R=112,C=224;
 for(let j=0;j<=R;j++){const lat=-Math.PI/2+Math.PI*j/R;for(let i=0;i<=C;i++){const lon=-Math.PI+2*Math.PI*i/C;vertices.push(Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon));}}
 for(let j=0;j<R;j++)for(let i=0;i<C;i++){const a=j*(C+1)+i,b=a+C+1;indexes.push(a,b,a+1,b,b+1,a+1);}
 const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);const pos=gl.getAttribLocation(prog,"pos");gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0);
 const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexes),gl.STATIC_DRAW);
 const u=(s)=>gl.getUniformLocation(prog,s);let yaw=.4,pitch=-.67,zoom=.75,sun=[.8,.15,.5],selected={lat:-89.5,lon:0};

 // Use a local NASA texture for reliable Pages hosting; remote URL is fallback.
 const NASA_URL="https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg";
 // Resolve relative to JS module (root Pages and Actions Pages have different bases).
 const LOCAL_URL=new URL("./assets/lroc_color_2k.jpg",import.meta.url).href;
 const texture=gl.createTexture();
 gl.activeTexture(gl.TEXTURE0);
 gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([170,170,170,255]));
 gl.uniform1i(u("moonColor"),0);
 const moonImage=new Image();
 moonImage.crossOrigin="anonymous";
 moonImage.onload=()=>{
   gl.activeTexture(gl.TEXTURE0);
   gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,moonImage);
   gl.generateMipmap(gl.TEXTURE_2D);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
   if(gl.getExtension("EXT_texture_filter_anisotropic")){
     const ext=gl.getExtension("EXT_texture_filter_anisotropic");
     gl.texParameterf(gl.TEXTURE_2D,ext.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
   }
   draw();
 };
 moonImage.onerror=()=>{
   if(moonImage.src!==NASA_URL){moonImage.src=NASA_URL;return;}
   console.warn("Could not load lunar texture, showing a neutral fallback sphere.");
 };
 moonImage.src=LOCAL_URL;

 function draw(){const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clearColor(.018,.043,.076,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(u("yaw"),yaw);gl.uniform1f(u("pitch"),pitch);gl.uniform1f(u("aspect"),w/h);gl.uniform1f(u("zoom"),zoom);gl.uniform3fv(u("sun"),sun);gl.drawElements(gl.TRIANGLES,indexes.length,gl.UNSIGNED_SHORT,0);projectMarker()}
 function view(p){let c=Math.cos(yaw),s=Math.sin(yaw),a=Math.cos(pitch),b=Math.sin(pitch);let x=c*p[0]+s*p[2],z=-s*p[0]+c*p[2];return [x,a*p[1]-b*z,b*p[1]+a*z]}
 function world(q){let a=Math.cos(pitch),b=Math.sin(pitch);let py=a*q[1]+b*q[2],pz=-b*q[1]+a*q[2];let c=Math.cos(yaw),s=Math.sin(yaw);return [c*q[0]-s*pz,py,s*q[0]+c*pz]}

 // Accessible DOM markers share the exact sphere projection used for selecting.
 // Their positions are reevaluated after every camera movement/zoom/resize.
 const parent=canvas.parentElement;
 const layer=document.createElement("div");layer.className="landing-site-layer";
 layer.setAttribute("aria-label","Historical lunar landing sites");parent.appendChild(layer);
 const tooltip=document.createElement("aside");tooltip.className="landing-site-tooltip";
 tooltip.hidden=true;tooltip.setAttribute("role","status");parent.appendChild(tooltip);
 const legend=document.createElement("div");legend.className="landing-site-legend";
 legend.innerHTML='<strong>Historical landings</strong>'+
  Object.entries(LANDING_ORGANIZATIONS).map(([key,org])=>
   '<span><i style="--marker-color:'+org.color+'"></i>'+org.name+'</span>').join("")+
  '<small>Markers: documented touchdown sites · hover for UTC details</small>';
 parent.appendChild(legend);
 const markers=HISTORIC_LANDING_SITES.map(site=>{
  const element=document.createElement("button");
  element.type="button";element.className="landing-site-marker";
  element.style.setProperty("--marker-color",LANDING_ORGANIZATIONS[site.org].color);
  element.title=site.name+" — "+readableLandingTime(site);
  element.setAttribute("aria-label",site.name+" landing, "+readableLandingTime(site));
  element.addEventListener("mouseenter",()=>{
   tooltip.replaceChildren();
   for(const [tag,txt] of [["strong",site.name],["span",LANDING_ORGANIZATIONS[site.org].name],
    ["span",site.place],["time",readableLandingTime(site)]]){
    const n=document.createElement(tag);n.textContent=txt;tooltip.appendChild(n);
   }
   tooltip.hidden=false;positionTooltip(element);
  });
  element.addEventListener("mouseleave",()=>tooltip.hidden=true);
  element.addEventListener("focus",()=>{
   element.dispatchEvent(new Event("mouseenter"));});
  element.addEventListener("blur",()=>tooltip.hidden=true);
  element.addEventListener("click",event=>{
   event.stopPropagation();
   selected={lat:site.lat,lon:site.lon};
   onSelect(site.lat,site.lon);draw();
  });
  layer.appendChild(element);
  return {site,element};
 });
 function positionTooltip(marker){
  const r=marker.getBoundingClientRect(),pr=parent.getBoundingClientRect();
  tooltip.style.left=Math.max(4,Math.min(pr.width-240,r.left-pr.left+16))+"px";
  tooltip.style.top=Math.max(8,Math.min(pr.height-135,r.top-pr.top-8))+"px";
 }
 function projectHistoricMarkers(){
  const rect=canvas.getBoundingClientRect(),pr=parent.getBoundingClientRect();
  const radius=Math.min(rect.width,rect.height)*zoom/2;
  for(const item of markers){
   const q=view(siteVector(item.site.lat,item.site.lon));
   const px=rect.left-pr.left+rect.width/2+q[0]*radius;
   const py=rect.top-pr.top+rect.height/2-q[1]*radius;
   const visible=q[2]>.015&&Math.hypot(q[0],q[1])<=1.005;
   item.element.hidden=!visible;
   if(visible){item.element.style.left=px+"px";item.element.style.top=py+"px";}
  }
 }

 function projectMarker(){let p=[Math.cos(selected.lat*Math.PI/180)*Math.sin(selected.lon*Math.PI/180),Math.sin(selected.lat*Math.PI/180),Math.cos(selected.lat*Math.PI/180)*Math.cos(selected.lon*Math.PI/180)],q=view(p);let marker=document.getElementById("selectedMarker");if(!marker){marker=document.createElement("div");marker.id="selectedMarker";marker.style.cssText="position:absolute;pointer-events:none;width:14px;height:14px;background:#f8d06b;border:2px solid white;box-shadow:0 0 18px #f6ca66,0 0 8px #ffeaac;border-radius:50%;transform:translate(-50%,-50%);z-index:2";canvas.parentElement.appendChild(marker)}let radius=Math.min(canvas.clientWidth,canvas.clientHeight)*zoom/2;marker.style.display=q[2]>=0?"block":"none";marker.style.left=(canvas.clientWidth/2+q[0]*radius)+"px";marker.style.top=(canvas.clientHeight/2-q[1]*radius)+"px";projectHistoricMarkers();}
 let start=null;
 canvas.addEventListener("pointerdown",e=>{canvas.setPointerCapture(e.pointerId);start={x:e.clientX,y:e.clientY,yaw,pitch,moved:false}});
 canvas.addEventListener("pointermove",e=>{if(!start)return;let dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>4)start.moved=true;yaw=start.yaw+dx*.008;pitch=Math.max(-1.55,Math.min(1.55,start.pitch+dy*.008));draw()});
 canvas.addEventListener("pointerup",e=>{if(!start)return;let moved=start.moved;start=null;if(moved)return;let r=canvas.getBoundingClientRect();let rad=Math.min(r.width,r.height)*zoom/2,x=(e.clientX-r.left-r.width/2)/rad,y=-(e.clientY-r.top-r.height/2)/rad;if(x*x+y*y>1)return;let p=world([x,y,Math.sqrt(1-x*x-y*y)]);let lat=Math.asin(Math.max(-1,Math.min(1,p[1])))*180/Math.PI,lon=Math.atan2(p[0],p[2])*180/Math.PI;selected={lat,lon};onSelect(lat,lon);draw()});
 canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(.3,Math.min(1.75,zoom*(e.deltaY>0?.92:1.08)));draw()},{passive:false});
 window.addEventListener("resize",draw);
 draw();return {setSun(x,y,z){sun=[x,y,z];draw()},focus(){yaw=0;pitch=-1.1;zoom=.9;draw()},
 reset(){yaw=.4;pitch=-.67;zoom=.75;selected={lat:-89.5,lon:0};tooltip.hidden=true;draw();},
 setSite(lat,lon){selected={lat,lon};draw()}};
}