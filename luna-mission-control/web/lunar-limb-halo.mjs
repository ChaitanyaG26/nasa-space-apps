/**
 * Decorative sunlight-responsive lunar limb halo.
 *
 * This layer draws behind the NASA-textured WebGL Moon. Its angular weighting
 * uses the same Moon-fixed Sun vector and the same camera rotation as the
 * lunar terminator. The halo is ARTISTIC, not lunar-atmosphere scattering:
 * the Moon essentially lacks an atmosphere.
 */
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

export function sunToMoonView(sun,yaw,pitch){
 if(!Array.isArray(sun)||sun.length!==3||sun.some(n=>!Number.isFinite(n))||
    !Number.isFinite(yaw)||!Number.isFinite(pitch))return null;
 const norm=Math.hypot(...sun);
 if(norm<1e-12)return null;
 const [x,y,z]=sun.map(n=>n/norm);
 const c=Math.cos(yaw),s=Math.sin(yaw),a=Math.cos(pitch),b=Math.sin(pitch);
 const rx=c*x+s*z,rz=-s*x+c*z;
 return [rx,a*y-b*rz,b*y+a*rz];
}

/** Rim angle is clockwise in canvas coordinates, starting at image-right. */
export function haloLimbStrength(sunView,angle){
 if(!sunView||sunView.length!==3||!Number.isFinite(angle))return 0;
 const [sx,sy,sz]=sunView;
 if(![sx,sy,sz].every(Number.isFinite))return 0;
 const norm=Math.hypot(sx,sy,sz);
 if(norm<1e-12)return 0;
 const ux=sx/norm,uy=sy/norm,uz=sz/norm;
 // A unit surface normal on the visible spherical silhouette has z = 0.
 // Canvas Y is downward, so the projected Sun Y is -uy.
 const incidence=Math.max(0,Math.cos(angle)*ux-Math.sin(angle)*uy);
 const projected=Math.hypot(ux,uy);
 // A very subtle symmetric glow is retained only when the Sun is almost
 // directly behind the viewer and the whole lunar face is sunlit.
 const fullPhase=Math.max(0,uz)*Math.pow(1-projected,2);
 return clamp(.88*Math.pow(incidence,.8)+.12*fullPhase,0,1);
}

/** Draw in transparent device pixels; call again after rotation or Sun update. */
export function drawLunarLimbHalo(ctx,{width,height,zoom,sunView}){
 if(!ctx||!(width>0&&height>0))return;
 ctx.clearRect(0,0,width,height);
 if(!sunView)return;
 const r=Math.min(width,height)*zoom/2;
 if(!Number.isFinite(r)||r<8)return;
 const cx=width/2,cy=height/2;
 const segments=96,step=Math.PI*2/segments;
 const passes=[
  {radius:1.06,width:.065,blur:.15,alpha:.23,color:"255,174,54"},
  {radius:1.018,width:.024,blur:.075,alpha:.48,color:"255,211,110"}
 ];
 ctx.save();
 ctx.lineCap="butt";
 for(const pass of passes){
  ctx.lineWidth=Math.max(2,r*pass.width);
  ctx.shadowBlur=Math.max(6,r*pass.blur);
  ctx.shadowColor="rgba("+pass.color+",0.8)";
  for(let i=0;i<segments;i++){
   const a=(i+.5)*step,strength=haloLimbStrength(sunView,a);
   if(strength<.012)continue;
   ctx.strokeStyle="rgba("+pass.color+","+(pass.alpha*strength).toFixed(4)+")";
   ctx.beginPath();
   ctx.arc(cx,cy,r*pass.radius,i*step-.004,(i+1)*step+.004);
   ctx.stroke();
  }
 }
 ctx.restore();
}
