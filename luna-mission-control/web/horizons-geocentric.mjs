/** JPL Horizons Earth-centered ICRF Moon and Sun state-vector cache.
 * Source: https://ssd-api.jpl.nasa.gov/doc/horizons.html
 * Interpolation uses cubic Hermite polynomials with published state velocities,
 * avoiding jumps and preserving smooth positions between hourly samples.
 * This provides celestial-body positions, NOT spacecraft navigation or COLA.
 */
const URL=new URL("./assets/horizons-geocentric-icrf.json",import.meta.url);
const HOUR_MS=3600000,DEG=180/Math.PI;
let promise=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const radius=(x,y,z)=>Math.hypot(x,y,z);
export function verifyGeocentricCache(data){
 if(data?.schema_version!==1||!Array.isArray(data.samples)||data.samples.length<2||
    data.origin!=="Earth center 500@399"||!String(data.frame).includes("ICRF"))
   throw Error("JPL geocentric vector cache has invalid origin/frame/schema");
 const step=(data.step_hours||0)*HOUR_MS;
 if(!Number.isFinite(step)||step<HOUR_MS||step>24*HOUR_MS)throw Error("Invalid cache interval");
 for(let i=0;i<data.samples.length;i++){
  const r=data.samples[i];
  if(!Array.isArray(r)||r.length!==13||!r.every(Number.isFinite))
   throw Error("Invalid JPL Earth-centered state vector");
  if(i>0&&r[0]-data.samples[i-1][0]!==step)throw Error("Missing JPL state-vector hour");
  if(!(300000<radius(...r.slice(1,4))&&radius(...r.slice(1,4))<450000))
   throw Error("Moon geocentric distance out of range");
  if(!(1.3e8<radius(...r.slice(7,10))&&radius(...r.slice(7,10))<1.6e8))
   throw Error("Sun geocentric distance out of range");
 }
 return data;
}
export async function loadGeocentricVectors(){
 if(!promise)promise=fetch(URL,{cache:"default"}).then(response=>{
  if(!response.ok)throw Error("JPL Earth-centered vector cache not yet published");
  return response.json();
 }).then(verifyGeocentricCache).catch(error=>{promise=null;throw error;});
 return promise;
}
export function hermitePosition(p0,v0,p1,v1,t,seconds){
 const u=clamp(t,0,1),u2=u*u,u3=u2*u;
 return (2*u3-3*u2+1)*p0+(u3-2*u2+u)*seconds*v0+
        (-2*u3+3*u2)*p1+(u3-u2)*seconds*v1;
}
export function interpolateState(a,b,frac,dtSeconds){
 const p=[],v=[],u=clamp(frac,0,1);
 for(let i=0;i<3;i++){
  p[i]=hermitePosition(a[i],a[3+i],b[i],b[3+i],u,dtSeconds);
  // Analytic Hermite derivative to avoid a noisy numerical differencing step.
  const u2=u*u;
  v[i]=((6*u2-6*u)*a[i]+(3*u2-4*u+1)*dtSeconds*a[3+i]+
        (-6*u2+6*u)*b[i]+(3*u2-2*u)*dtSeconds*b[3+i])/dtSeconds;
 }
 const d=radius(...p);
 return {x:p[0],y:p[1],z:p[2],vx:v[0],vy:v[1],vz:v[2],
  ra:(Math.atan2(p[1],p[0])*DEG+360)%360,
  dec:Math.asin(clamp(p[2]/d,-1,1))*DEG,
  distanceKm:d};
}
export function geocentricAt(data,utc){
 const time=typeof utc==="number"?utc:Date.parse(utc);
 const rows=data.samples,first=rows[0][0],last=rows.at(-1)[0];
 if(!Number.isFinite(time)||time<first||time>last)throw Error("UTC outside JPL geocentric cache coverage");
 const i=clamp(Math.floor((time-first)/HOUR_MS),0,rows.length-2);
 const a=rows[i],b=rows[i+1],t=(time-a[0])/(b[0]-a[0]),seconds=(b[0]-a[0])/1000;
 return {moon:interpolateState(a.slice(1,7),b.slice(1,7),t,seconds),
  sun:interpolateState(a.slice(7,13),b.slice(7,13),t,seconds),
  source:"NASA JPL Horizons geocentric ICRF state vectors, cubic Hermite interpolation",
  time:new Date(time).toISOString()};
}
