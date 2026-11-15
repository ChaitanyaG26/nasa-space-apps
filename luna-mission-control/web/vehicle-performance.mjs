/** Public launch-vehicle reference data for EDUCATIONAL payload screening.
 * Does not compute flight-ready ascent profiles, launch windows, steering, or
 * conjunction clearance. Liftoff masses and thrust are approximate, and
 * published gross vehicle mass may already include a mission payload.
 *
 * Falcon 9/Heavy: https://new.spacex.com/vehicles/falcon-9
 * SLS Block 1: https://www.nasa.gov/reference/space-launch-system/
 * Firefly Alpha: https://fireflyspace.com/alpha/
 */
const G0=9.80665;
export const VEHICLE_SPECS=Object.freeze({
 falcon9: Object.freeze({name:"Falcon 9",massKg:549054,thrustN:7607000,
   payloadLEOKg:22800,source:"SpaceX Falcon 9",sourceUrl:"https://new.spacex.com/vehicles/falcon-9"}),
 falconheavy:Object.freeze({name:"Falcon Heavy",massKg:1420788,thrustN:22240000,
   payloadLEOKg:63800,source:"SpaceX Falcon Heavy (liftoff thrust approx.)",sourceUrl:"https://new.spacex.com/vehicles/falcon-heavy"}),
 sls:Object.freeze({name:"SLS Block 1",massKg:2603000,thrustN:36786000,
   payloadLEOKg:95000,payloadTLIMinKg:27000,
   source:"NASA SLS Block 1 Reference Guide",sourceUrl:"https://www.nasa.gov/reference/space-launch-system/"}),
 alpha:Object.freeze({name:"Firefly Alpha",payloadLEOKg:1030,
   source:"Firefly Alpha (300 km LEO)",sourceUrl:"https://fireflyspace.com/alpha/"})
});
export function checkPayloadMass(value){
 const mass=Number(value);
 if(!Number.isFinite(mass)||mass<=0||mass>200000)throw new RangeError("Enter a payload mass between 1 and 200,000 kg");
 return mass;
}
/** Conservative *data-completeness* assessment, not translunar certification.
 * Published gross mass may already include a reference payload; this is a
 * transparent additive sensitivity estimate, not a measured vehicle mass.
 */
export function assessVehicle(vehicleId,payloadKg=500){
 const payload=checkPayloadMass(payloadKg),spec=VEHICLE_SPECS[vehicleId]||null;
 if(!spec)return {known:false,payloadKg:payload,leoCapacityKnown:false,
  performanceKnown:false,reason:"No verified public vehicle specification loaded"};
 const leoCapacityKnown=Number.isFinite(spec.payloadLEOKg);
 const performanceKnown=Number.isFinite(spec.massKg)&&Number.isFinite(spec.thrustN);
 const massProxyKg=performanceKnown?spec.massKg+payload:null;
 const twr=performanceKnown?spec.thrustN/(massProxyKg*G0):null;
 return {known:true,vehicleId,name:spec.name,payloadKg:payload,
  massProxyKg,thrustN:spec.thrustN??null,
  initialTwrProxy:twr,payloadLEOKg:spec.payloadLEOKg??null,
  leoUtilization:leoCapacityKnown?payload/spec.payloadLEOKg:null,
  leoCapacityKnown,performanceKnown,
  preliminaryLEOCheck:leoCapacityKnown?
   payload<=spec.payloadLEOKg?"WITHIN PUBLISHED LEO LIMIT":"EXCEEDS PUBLISHED LEO LIMIT":
   "INSUFFICIENT DATA",
  source:spec.source,sourceUrl:spec.sourceUrl,
  limitation:"Only a gross-mass/liftoff-thrust sensitivity and published LEO payload check. No fuel flow, staging, ascent, upper stage, TLI or lunar delivery performance has been verified."};
}
