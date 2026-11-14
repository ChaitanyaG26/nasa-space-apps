/** Transparent engineering estimates, NOT NASA-validated lander hardware.
 * Thermal physics follows NASA HLS Lunar Thermal Analysis Guidebook:
 * https://ntrs.nasa.gov/citations/20210010030
 * RF link follows NASA SmallSat State-of-the-Art communications guidance:
 * https://www.nasa.gov/smallsat-institute/sst-soa/ground-data-systems-and-mission-operations/
 * Inputs are explicitly declared spacecraft / ground-station assumptions.
 */
export const THERMAL_DEFAULTS=Object.freeze({
 thermal_capacity_j_k:120000,
 radiator_area_m2:0.35,
 solar_body_area_m2:0.6,
 solar_absorptivity:0.2,
 radiator_emissivity:0.8,
 ground_view_factor:0.3,
 ground_conductance_w_k:0.15,
 initial_temp_c:20,
 heater_setpoint_c:-5,
 heater_w:80,
 operational_min_c:-20,
 operational_max_c:50,
 internal_heat_fraction:0.7
});
export const RADIO_DEFAULTS=Object.freeze({
 rf_tx_w:5,rf_tx_gain_dbi:8,rf_ground_gt_dbk:25,
 rf_frequency_ghz:2.25,rf_bitrate_bps:10000,
 rf_loss_db:4,rf_required_ebn0_db:7,rf_required_margin_db:3
});
const SIGMA=5.670374419e-8, K=273.15, SPACE=3;
export function thermalParameters(input={}){
 const out={...THERMAL_DEFAULTS};
 for(const [key,[min,max]] of Object.entries({
  thermal_capacity_j_k:[1000,10000000],
  radiator_area_m2:[0.005,20],
  solar_body_area_m2:[0,20],
  heater_w:[0,1000],heater_setpoint_c:[-130,100],
  operational_min_c:[-130,50],operational_max_c:[-40,150],
  initial_temp_c:[-100,100]
 })){
  if(input[key]!==undefined&&input[key]!==null&&input[key]!=="")out[key]=Number(input[key]);
  if(!Number.isFinite(out[key])||out[key]<min||out[key]>max)
   throw Error("Invalid thermal assumption: "+key);
 }
 if(out.operational_min_c>=out.operational_max_c)throw Error("Thermal screening min must be below max");
 return out;
}
export function radioParameters(input={}){
 const out={...RADIO_DEFAULTS};
 const ranges={rf_tx_w:[0.01,1000],rf_tx_gain_dbi:[-10,60],rf_ground_gt_dbk:[-20,80],
  rf_frequency_ghz:[0.1,40],rf_bitrate_bps:[1,1e8],rf_loss_db:[0,60],
  rf_required_ebn0_db:[-5,30],rf_required_margin_db:[0,30]};
 for(const [key,[min,max]] of Object.entries(ranges)){
  if(input[key]!==undefined&&input[key]!==null&&input[key]!=="")out[key]=Number(input[key]);
  if(!Number.isFinite(out[key])||out[key]<min||out[key]>max)
   throw Error("Invalid RF assumption: "+key);
 }
 return out;
}
export function radioLinkBudget(distanceKm,opts=RADIO_DEFAULTS){
 if(distanceKm===null||distanceKm===undefined)return null;
 if(!Number.isFinite(distanceKm)||distanceKm<1e5||distanceKm>1e6)
   throw Error("NASA Earth range missing or physically implausible");
 const r=radioParameters(opts);
 const fspl=92.45+20*Math.log10(distanceKm)+20*Math.log10(r.rf_frequency_ghz);
 const eirp=10*Math.log10(r.rf_tx_w)+r.rf_tx_gain_dbi;
 const cN0=eirp-fspl-r.rf_loss_db+r.rf_ground_gt_dbk+228.6;
 const ebN0=cN0-10*Math.log10(r.rf_bitrate_bps);
 const margin=ebN0-r.rf_required_ebn0_db;
 return {
  path_loss_db:fspl,cn0_db_hz:cN0,ebn0_db:ebN0,
  margin_db:margin,threshold_db:r.rf_required_margin_db,
  passes_assumed_budget:margin>=r.rf_required_margin_db,
  frequency_ghz:r.rf_frequency_ghz,bitrate_bps:r.rf_bitrate_bps
 };
}
/** Step one lumped node with 4 x 15-minute explicit Euler updates.
 * Q = absorbed Sun + internal dissipation + modeled heater
 *     + terrain IR/conduction - radiator radiation to space.
 * This is a sensitivity model, not a validated flight thermal network.
 */
export function thermalStep(temperatureK,regolithC,solarIrradiance,visibleFraction,loadW,opts=THERMAL_DEFAULTS,heaterAvailable=true,stepSeconds=3600){
 const p=thermalParameters(opts);
 if(![temperatureK,regolithC,solarIrradiance,visibleFraction,loadW,stepSeconds].every(Number.isFinite)||
    temperatureK<=0||solarIrradiance<0||visibleFraction<0||visibleFraction>1||stepSeconds<=0)
   throw Error("Invalid lander thermal model inputs");
 let temp=temperatureK,heaterEnergyWh=0;
 const n=Math.ceil(stepSeconds/900),dt=stepSeconds/n;
 for(let k=0;k<n;k++){
  const heater=heaterAvailable&&temp<p.heater_setpoint_c+K?p.heater_w:0;
  const ground=Math.max(1,regolithC+K);
  const absorbed=p.solar_absorptivity*p.solar_body_area_m2*solarIrradiance*visibleFraction;
  const internal=p.internal_heat_fraction*loadW;
  const exchange=p.ground_view_factor*p.radiator_emissivity*p.radiator_area_m2*SIGMA*(ground**4-temp**4)
    +p.ground_conductance_w_k*(ground-temp);
  const radiator=p.radiator_emissivity*p.radiator_area_m2*SIGMA*(temp**4-SPACE**4);
  const watts=absorbed+internal+heater+exchange-radiator;
  temp+=watts*dt/p.thermal_capacity_j_k;
  temp=Math.max(1,temp); // numerical absolute-zero guard
  heaterEnergyWh+=heater*dt/3600;
 }
 return {
  temp_k:temp,temp_c:temp-K,
  average_heater_w:heaterEnergyWh*3600/stepSeconds,
  heater_energy_wh:heaterEnergyWh,
  thermal_screen_flag:temp-K<p.operational_min_c||temp-K>p.operational_max_c,
  status:"PROJECTED LUMPED-NODE LANDER TEMPERATURE — ASSUMED THERMAL HARDWARE; NOT VALIDATED"
 };
}
