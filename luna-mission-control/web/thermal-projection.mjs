/** Transparent lunar REGOLITH equilibrium-temperature projection.
 *
 * NASA Diviner LRO observational reference:
 * https://www.diviner.ucla.edu/science
 * Equatorial lunar soil reaches ~400 K at noon, below 100 K at night.
 * https://www.diviner.ucla.edu/data
 *
 * This is NOT a Diviner temperature lookup for the selected coordinates/date.
 * The background term (95 K), albedo (0.12) and emissivity (0.95) are
 * engineering assumptions. A one-node radiative equilibrium ignores thermal
 * inertia and cannot predict spacecraft temperature or hibernation needs.
 */
export const STEFAN_BOLTZMANN=5.670374419e-8;
export const REGOLITH_ASSUMPTIONS=Object.freeze({
  albedo:0.12,
  emissivity:0.95,
  background_temperature_k:95
});
export const THERMAL_PROVENANCE=Object.freeze({
  status:"PROJECTED — NOT SITE-VALIDATED",
  quantity:"Idealized regolith radiative-equilibrium surface temperature, not spacecraft temperature",
  nasa_reference:"NASA LRO Diviner Lunar Radiometer Experiment",
  url:"https://www.diviner.ucla.edu/science",
  archive_url:"https://pds-geosciences.wustl.edu/missions/lro/diviner.htm",
  assumptions:"Regolith albedo 0.12, emissivity 0.95, radiation background 95 K",
  limitations:"Not a Diviner map lookup; no subsurface heat diffusion, thermal inertia, local roughness, reradiation from terrain, or lander thermal hardware. The background assumption is not valid for permanently shadowed cold traps."
});
export function projectRegolithTemperatureC(
  irradianceWm2,sunElevationDeg,visibleDiskFraction,opts=REGOLITH_ASSUMPTIONS
){
  const {albedo,emissivity,background_temperature_k:backgroundK}=opts;
  if(![irradianceWm2,sunElevationDeg,visibleDiskFraction,albedo,emissivity,backgroundK].every(Number.isFinite))
    throw Error("Regolith thermal projection received invalid numeric input");
  if(irradianceWm2<0||visibleDiskFraction<0||visibleDiskFraction>1||albedo<0||albedo>1||emissivity<=0||emissivity>1||backgroundK<=0)
    throw Error("Regolith thermal projection assumption outside physical bounds");
  const theta=Math.max(0,Math.sin(sunElevationDeg*Math.PI/180));
  const absorbed=(1-albedo)*irradianceWm2*theta*visibleDiskFraction;
  const kelvin=Math.pow(Math.pow(backgroundK,4)+absorbed/(emissivity*STEFAN_BOLTZMANN),0.25);
  return Number((kelvin-273.15).toFixed(2));
}
export function powerConservationFlag(socPercent,reservePercent,powerW,loadW){
  if(![socPercent,reservePercent,powerW,loadW].every(Number.isFinite))return false;
  // This is an advisory screening heuristic, NOT a spacecraft hibernation command.
  return socPercent<=reservePercent+10 && powerW<loadW;
}
