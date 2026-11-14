// Self-contained WebGL lunar sphere with procedural crater shading.
// This is a visual prototype, not an elevation-resolved LOLA surface.
export function initGlobe(canvas,onSelect) {
 const gl=canvas.getContext("webgl2",{antialias:true}) || canvas.getContext("webgl",{antialias:true});
 if(!gl){const ctx=canvas.getContext("2d");ctx.fillStyle="#425a69";ctx.fillRect(0,0,canvas.width,canvas.height);return {setSun(){},focus(){},setSite(){}}}
 const vs=gl.createShader(gl.VERTEX_SHADER);
 gl.shaderSource(vs,"attribute vec3 pos;uniform float yaw,pitch,aspect,zoom;varying vec3 normal;varying vec3 cameraNormal;void main(){float c=cos(yaw),s=sin(yaw),a=cos(pitch),b=sin(pitch);vec3 p=vec3(c*pos.x+s*pos.z,pos.y,-s*pos.x+c*pos.z);vec3 q=vec3(p.x,a*p.y-b*p.z,b*p.y+a*p.z);normal=pos;cameraNormal=q;gl_Position=vec4(q.x*zoom/aspect,q.y*zoom,q.z*.5,1.);}");
 gl.compileShader(vs);
 const fs=gl.createShader(gl.FRAGMENT_SHADER);
 gl.shaderSource(fs,"precision mediump float;varying vec3 normal;varying vec3 cameraNormal;uniform vec3 sun;void main(){if(cameraNormal.z<0.)discard;vec3 n=normalize(normal);float grain=sin(n.x*84.)*sin(n.y*110.)*sin(n.z*92.);float craters=0.;for(int i=0;i<18;i++){float t=float(i);vec3 c=normalize(vec3(sin(t*17.9),cos(t*13.4),sin(t*9.2+1.)));float d=acos(clamp(dot(n,c),-1.,1.));float r=.06+mod(t,5.)*.027;craters+=.25*exp(-pow((d-r)/.014,2.))-.19*exp(-pow(d/(r*.72),4.));}float albedo=clamp(.57+grain*.052+craters,.17,.86);float lit=.10+.9*max(0.,dot(n,normalize(sun)));float edge=pow(1.-max(0.,cameraNormal.z),2.);vec3 col=vec3(.67,.73,.77)*albedo*lit+edge*vec3(.02,.07,.1);gl_FragColor=vec4(col,1.);}");
 gl.compileShader(fs);const prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);gl.useProgram(prog);
 const vertices=[],indexes=[],R=60,C=110;
 for(let j=0;j<=R;j++){const lat=-Math.PI/2+Math.PI*j/R;for(let i=0;i<=C;i++){const lon=-Math.PI+2*Math.PI*i/C;vertices.push(Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon));}}
 for(let j=0;j<R;j++)for(let i=0;i<C;i++){const a=j*(C+1)+i,b=a+C+1;indexes.push(a,b,a+1,b,b+1,a+1);}
 const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);const pos=gl.getAttribLocation(prog,"pos");gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0);
 const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexes),gl.STATIC_DRAW);
 const u=(s)=>gl.getUniformLocation(prog,s);let yaw=.4,pitch=-.67,zoom=.75,sun=[.8,.15,.5],selected={lat:-89.5,lon:0};
 function draw(){const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clearColor(.018,.043,.076,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(u("yaw"),yaw);gl.uniform1f(u("pitch"),pitch);gl.uniform1f(u("aspect"),w/h);gl.uniform1f(u("zoom"),zoom);gl.uniform3fv(u("sun"),sun);gl.drawElements(gl.TRIANGLES,indexes.length,gl.UNSIGNED_SHORT,0);projectMarker()}
 function view(p){let c=Math.cos(yaw),s=Math.sin(yaw),a=Math.cos(pitch),b=Math.sin(pitch);let x=c*p[0]+s*p[2],z=-s*p[0]+c*p[2];return [x,a*p[1]-b*z,b*p[1]+a*z]}
 function world(q){let a=Math.cos(pitch),b=Math.sin(pitch);let py=a*q[1]+b*q[2],pz=-b*q[1]+a*q[2];let c=Math.cos(yaw),s=Math.sin(yaw);return [c*q[0]-s*pz,py,s*q[0]+c*pz]}
 function projectMarker(){let p=[Math.cos(selected.lat*Math.PI/180)*Math.sin(selected.lon*Math.PI/180),Math.sin(selected.lat*Math.PI/180),Math.cos(selected.lat*Math.PI/180)*Math.cos(selected.lon*Math.PI/180)],q=view(p);let marker=document.getElementById("selectedMarker");if(!marker){marker=document.createElement("div");marker.id="selectedMarker";marker.style.cssText="position:absolute;pointer-events:none;width:14px;height:14px;background:#60faec;border:2px solid white;box-shadow:0 0 20px #25e9db;border-radius:50%;transform:translate(-50%,-50%);z-index:2";canvas.parentElement.appendChild(marker)}let radius=Math.min(canvas.clientWidth,canvas.clientHeight)*zoom/2;marker.style.display=q[2]>=0?"block":"none";marker.style.left=(canvas.clientWidth/2+q[0]*radius)+"px";marker.style.top=(canvas.clientHeight/2-q[1]*radius)+"px"}
 let start=null;
 canvas.addEventListener("pointerdown",e=>{canvas.setPointerCapture(e.pointerId);start={x:e.clientX,y:e.clientY,yaw,pitch,moved:false}});
 canvas.addEventListener("pointermove",e=>{if(!start)return;let dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>4)start.moved=true;yaw=start.yaw+dx*.008;pitch=Math.max(-1.55,Math.min(1.55,start.pitch+dy*.008));draw()});
 canvas.addEventListener("pointerup",e=>{if(!start)return;let moved=start.moved;start=null;if(moved)return;let r=canvas.getBoundingClientRect();let rad=Math.min(r.width,r.height)*zoom/2,x=(e.clientX-r.left-r.width/2)/rad,y=-(e.clientY-r.top-r.height/2)/rad;if(x*x+y*y>1)return;let p=world([x,y,Math.sqrt(1-x*x-y*y)]);let lat=Math.asin(Math.max(-1,Math.min(1,p[1])))*180/Math.PI,lon=Math.atan2(p[0],p[2])*180/Math.PI;selected={lat,lon};onSelect(lat,lon);draw()});
 canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(.3,Math.min(1.75,zoom*(e.deltaY>0?.92:1.08)));draw()},{passive:false});
 window.addEventListener("resize",draw);
 draw();return {setSun(x,y,z){sun=[x,y,z];draw()},focus(){yaw=0;pitch=-1.1;zoom=.9;draw()},setSite(lat,lon){selected={lat,lon};draw()}};
}