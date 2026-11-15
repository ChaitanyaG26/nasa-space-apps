/** Physics-scoped animations. SI units, not vehicle-specific flight dynamics.
 * Source: NASA Moon Fact Sheet: lunar surface gravity 1.62 m/s².
 * Constant-net-deceleration terminal segment, not a guided landing solution.
 * The model starts at a *specified* 180 m altitude: orbital descent to that
 * start point, attitude, propellant, thrust throttle and terrain hazards are
 * explicitly outside scope.
 */
export const MOON_GRAVITY_M_S2=1.62;
export const MOON_MEAN_RADIUS_KM=1737.4;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function descentParameters({
 altitudeM=180,entryDownSpeedMS=14,touchDownSpeedMS=.8,gravityMS2=MOON_GRAVITY_M_S2
}={}){
 if(![altitudeM,entryDownSpeedMS,touchDownSpeedMS,gravityMS2].every(Number.isFinite)||
    altitudeM<=0||entryDownSpeedMS<=touchDownSpeedMS||touchDownSpeedMS<0||gravityMS2<=0)
   throw new RangeError("Invalid terminal descent assumptions");
 const seconds=2*altitudeM/(entryDownSpeedMS+touchDownSpeedMS);
 const downwardAccelerationMS2=(touchDownSpeedMS-entryDownSpeedMS)/seconds;
 return {altitudeM,entryDownSpeedMS,touchDownSpeedMS,gravityMS2,
  seconds,downwardAccelerationMS2,
  thrustAccelerationMS2:gravityMS2-downwardAccelerationMS2,
  thrustToWeight:(gravityMS2-downwardAccelerationMS2)/gravityMS2,
  note:"Simplified terminal vertical descent; no propulsion or GNC certification"};
}
export function descentAt(fraction,parameters=descentParameters()){
 const t=clamp(fraction,0,1),seconds=t*parameters.seconds;
 const height=parameters.altitudeM-parameters.entryDownSpeedMS*seconds-
  .5*parameters.downwardAccelerationMS2*seconds**2;
 const speed=parameters.entryDownSpeedMS+parameters.downwardAccelerationMS2*seconds;
 return {elapsedS:seconds,heightM:Math.max(0,height),downSpeedMS:Math.max(parameters.touchDownSpeedMS,speed),
  gravityMS2:parameters.gravityMS2,thrustAccelerationMS2:parameters.thrustAccelerationMS2};
}
export function profileSlopeDeg(profile){
 if(!Array.isArray(profile)||profile.length<3)return null;
 const center=Math.floor(profile.length/2),a=profile[center-1],b=profile[center+1];
 if(!a||!b||!Number.isFinite(a.heightM)||!Number.isFinite(b.heightM)||
    !Number.isFinite(a.offsetM)||!Number.isFinite(b.offsetM)||b.offsetM===a.offsetM)return null;
 return Math.atan2(Math.abs(b.heightM-a.heightM),Math.abs(b.offsetM-a.offsetM))*180/Math.PI;
}
export function normalizeTerrainProfile(profile){
 if(!Array.isArray(profile)||profile.length<3)return null;
 const sorted=[...profile].sort((a,b)=>a.offsetM-b.offsetM);
 const mid=sorted.reduce((a,b)=>Math.abs(b.offsetM)<Math.abs(a.offsetM)?b:a);
 if(!Number.isFinite(mid.heightM))return null;
 const good=sorted.filter(x=>Number.isFinite(x.heightM));
 if(good.length/sorted.length<.8)return null;
 return {samples:sorted,centerHeightM:mid.heightM,validFraction:good.length/sorted.length,
  slopeDeg:profileSlopeDeg(sorted)};
}
// Kinematic presentation curve for a generic ascent section only.
// No vehicle thrust, atmosphere, or range orientation has been solved.
export function genericAscentAt(fraction,{durationS=110,initialVerticalMS=0,netAccelerationMS2=10}={}){
 const t=clamp(fraction,0,1)*durationS;
 return {elapsedS:t,altitudeM:initialVerticalMS*t+.5*netAccelerationMS2*t*t,
  verticalSpeedMS:initialVerticalMS+netAccelerationMS2*t};
}
