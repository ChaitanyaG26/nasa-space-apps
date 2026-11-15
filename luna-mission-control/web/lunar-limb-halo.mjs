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

/**
 * Continuous halo with no arc primitives, joins, or individually blurred
 * shadow segments. Alpha is evaluated from distance to the sphere and the
 * projected Sun direction for every raster sample.
 *
 * The sample is painted into a reusable lower-resolution backing canvas,
 * then smoothly upscaled. This keeps camera dragging responsive, including
 * on high-density mobile screens, while avoiding angular bands.
 */
const RADIAL_SAMPLES=2048,LIGHT_SAMPLES=1024;
const MAX_RADIAL_DISTANCE=.56;
const radialOuter=new Float32Array(RADIAL_SAMPLES+1);
const radialInner=new Float32Array(RADIAL_SAMPLES+1);
const lightCurve=new Float32Array(LIGHT_SAMPLES+1);
for(let i=0;i<=RADIAL_SAMPLES;i++){
 const distance=i/RADIAL_SAMPLES*MAX_RADIAL_DISTANCE;
 radialOuter[i]=Math.exp(-Math.pow(distance/.235,1.48));
 radialInner[i]=Math.exp(-Math.pow(distance/.074,1.65));
}
for(let i=0;i<=LIGHT_SAMPLES;i++)lightCurve[i]=Math.pow(i/LIGHT_SAMPLES,.8);
const scratchByContext=new WeakMap();

/**
 * Pure analytical pixel renderer. Returns an RGBA bitmap on transparent black.
 * This is a decorative, camera-Sun-locked visualization, not physical light
 * scattered by the almost-atmosphere-free Moon.
 */
export function lunarHaloBitmap({width,height,zoom,sunView,maxDimension=880}){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||
    !Number.isFinite(zoom)||zoom<=0 || !sunView ||
    !sunView.every(Number.isFinite)||Math.hypot(...sunView)<1e-9)return null;
 const scale=Math.min(1,maxDimension/Math.max(width,height));
 const w=Math.max(1,Math.round(width*scale));
 const h=Math.max(1,Math.round(height*scale));
 const pixels=new Uint8ClampedArray(w*h*4);
 const r=Math.min(w,h)*zoom/2;
 if(r<8)return {width:w,height:h,pixels};
 const sx=sunView[0],sy=sunView[1],sz=sunView[2];
 const norm=Math.hypot(sx,sy,sz);
 const ux=sx/norm,uy=sy/norm,uz=sz/norm;
 const projected=Math.hypot(ux,uy);
 const fullPhase=.12*Math.max(0,uz)*Math.pow(1-projected,2);
 // Compute only the visible annulus. The sphere covers the inner ring.
 const cx=w/2,cy=h/2,limit=r*(1+MAX_RADIAL_DISTANCE);
 const x0=Math.max(0,Math.floor(cx-limit)),x1=Math.min(w,Math.ceil(cx+limit));
 const y0=Math.max(0,Math.floor(cy-limit)),y1=Math.min(h,Math.ceil(cy+limit));
 for(let y=y0;y<y1;y++){
  const dy=y+.5-cy;
  for(let x=x0;x<x1;x++){
   const dx=x+.5-cx;
   const dist=Math.hypot(dx,dy);
   if(dist<r*.985||dist>limit)continue;
   const radial=(dist/r-1);
   const ri=Math.min(RADIAL_SAMPLES,Math.max(0,Math.round(radial/MAX_RADIAL_DISTANCE*RADIAL_SAMPLES)));
   const sunFacing=Math.max(0,(dx*ux-dy*uy)/Math.max(dist,1e-10));
   const li=Math.min(LIGHT_SAMPLES,Math.round(sunFacing*LIGHT_SAMPLES));
   const illumination=Math.min(1,.88*lightCurve[li]+fullPhase);
   if(illumination<.002)continue;
   // Two smooth overlapping envelopes create a warm inner rim and a broad,
   // conspicuous amber bloom. No sectors, seams, or Canvas2D stroke joins.
   const inner=.89*radialInner[ri],outer=.58*radialOuter[ri];
   const combined=1-(1-inner)*(1-outer);
   const alpha=illumination*combined;
   if(alpha<.001)continue;
   const colorMix=inner/(inner+outer+1e-12);
   const at=(y*w+x)*4;
   pixels[at]=255;
   pixels[at+1]=Math.round(166+50*colorMix);
   pixels[at+2]=Math.round(56+62*colorMix);
   pixels[at+3]=Math.round(255*Math.min(1,alpha));
  }
 }
 return {width:w,height:h,pixels};
}

/** Draw a seamless, bilinearly upscaled image behind the WebGL sphere. */
export function drawLunarLimbHalo(ctx,{width,height,zoom,sunView}){
 if(!ctx||!(width>0&&height>0))return;
 ctx.clearRect(0,0,width,height);
 const bitmap=lunarHaloBitmap({width,height,zoom,sunView});
 if(!bitmap||!bitmap.pixels.some(v=>v>0))return;
 let scratch=scratchByContext.get(ctx);
 if(!scratch){
  const doc=ctx.canvas?.ownerDocument||(typeof document!=="undefined"?document:null);
  const canvas=doc?.createElement?.("canvas")||
   (typeof OffscreenCanvas!=="undefined"?new OffscreenCanvas(bitmap.width,bitmap.height):null);
  if(!canvas)return;
  const context=canvas.getContext("2d");
  if(!context)return;
  scratch={canvas,context};
  scratchByContext.set(ctx,scratch);
 }
 if(scratch.canvas.width!==bitmap.width)scratch.canvas.width=bitmap.width;
 if(scratch.canvas.height!==bitmap.height)scratch.canvas.height=bitmap.height;
 const image=scratch.context.createImageData(bitmap.width,bitmap.height);
 image.data.set(bitmap.pixels);
 scratch.context.putImageData(image,0,0);
 ctx.save();
 ctx.imageSmoothingEnabled=true;
 if("imageSmoothingQuality" in ctx)ctx.imageSmoothingQuality="high";
 ctx.drawImage(scratch.canvas,0,0,width,height);
 ctx.restore();
}
