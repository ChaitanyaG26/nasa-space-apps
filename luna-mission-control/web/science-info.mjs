/**
 * Scientific context for the Simulation Information side panel.
 * All entries are explanatory UI only; computations remain in the science engines.
 */
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const validNumber = value => typeof value === "number" && Number.isFinite(value);
const infoRow = (name,value) =>
  '<div class="science-info-row"><dt>'+escapeHTML(name)+'</dt><dd>'+escapeHTML(value)+'</dd></div>';
const group = (title,rows) =>
  '<section class="science-info-group"><h4>'+escapeHTML(title)+'</h4><dl>'+rows.join("")+'</dl></section>';

export function renderScenarioInfo(data,label){
  if(!data) return "";
  const q=data.quality||{}, t=data.terrain||{}, h=data.regional_horizon, route=data.rover_route;
  const at=data.site ? Number(data.site.latitude).toFixed(3)+"°, "+Number(data.site.longitude).toFixed(3)+"°" : "Unavailable";
  const terrainRows=[
    infoRow("Source / resolution",t.coverage?
      (t.detail_coverage?"NASA LOLA 20 m local digital elevation model":"NASA LOLA 8 pixels/degree regional elevation model"):
      "No LOLA elevation available at this coordinate"),
    infoRow("Surface elevation",t.coverage&&validNumber(t.elevation_km)?
      t.elevation_km.toFixed(3)+" km above the lunar reference sphere":"Unavailable"),
    infoRow("Largest modeled skyline obstruction",h&&validNumber(h.max_obstruction_deg)?
      h.max_obstruction_deg+"°":"Regional skyline unavailable"),
    infoRow("Nearby ridge coverage",h?
      (h.near_field_resolved?
        "20 m LOLA local detail to approximately 3 km; coarse terrain beyond. Small hazards remain unresolved.":
        "Coarse regional LOLA only; small or nearby hazards may be unresolved."):
      "Unknown: terrain profile unavailable"),
    infoRow("Local slope screening",t.detail_coverage?
      (validNumber(t.detail_slope_deg)?t.detail_slope_deg.toFixed(1)+"° (not certified rover-traversable)":"Unavailable"):
      "No local 20 m slope estimate")
  ];
  const routeText=route?.available?
    (String(route.status||"Rover corridor screening available")+
      (route.found?" · Length "+route.length_m+" m · Peak segment slope "+route.maximum_segment_slope_deg+"°":"")+
      " · NOT a verified rover-safe path"):
    "No NASA 20 m terrain patch available for rover corridor screening at this coordinate.";
  terrainRows.push(infoRow("Rover corridor",routeText));
  const thermalRows=[
    infoRow("Regolith model","Projected radiative equilibrium: albedo 0.12, emissivity 0.95, baseline 95 K."),
    infoRow("Lander temperature","Separate projected one-node thermal model based on assumed hardware, not a certified spacecraft temperature prediction."),
    infoRow("NASA Diviner context",q.diviner_observations||"Historical reference not loaded"),
    infoRow("Historical comparison",validNumber(q.thermal_model_mean_abs_error_c)?
      q.thermal_model_mean_abs_error_c+" °C mean absolute difference against historical local-time climatology; NOT a forecast validation.":
      "No matched historical comparison available."),
    infoRow("Observation date caveat","Diviner observations are historical, usually 2009–2015 local-time bins, not temperatures observed at the selected mission UTC.")
  ];
  const ephemRows=[
    infoRow("Ephemeris / geometry",q.ephemeris||"Source details unavailable"),
    infoRow("Independent JPL Horizons check",q.horizons_direct_validation||"Independent site-specific validation unavailable")
  ];
  return '<article class="science-info-scenario">'+
    '<h3>'+escapeHTML(label)+' <small>'+escapeHTML(at)+'</small></h3>'+
    group("NASA sources and validation",ephemRows)+
    group("Terrain and rover screening",terrainRows)+
    group("Temperatures and historical observations",thermalRows)+
    group("Communications and seismic limits",[
      infoRow("Direct-to-Earth","Earth-center terrain clearance is geometric visibility, not a guaranteed radio contact."),
      infoRow("S-band radio model","RF link margins use assumed transmitter power, antenna gain, receiver sensitivity and bitrate; not a verified real ground-station link."),
      infoRow("Seismic hazard","No location-specific seismic hazard forecast is available. Seismic risk is NOT assessed or certified safe."),
      infoRow("Flight readiness","Power, battery, lander thermal, RF and rover outputs are engineering projections, not mission or flight certification.")
    ])+
    '</article>';
}

export function renderScientificInformation(result,comparison){
  if(!result) return '<p>Run a simulation to view its NASA sources and scientific assumptions.</p>';
  const compare=comparison?
    '<section class="science-info-group"><h4>Comparison method</h4><p>'+
    escapeHTML(comparison.search||"Alternative scenario comparison")+'</p><p>'+
    escapeHTML(comparison.comparison_note||"")+'</p></section>':"";
  return '<div class="science-info-intro"><p><b>Measured or NASA-derived:</b> JPL Horizons geometry, NASA LOLA elevation and historical Diviner references when available.</p>'+
    '<p><b>Modeled:</b> power, battery charge, terrain-dependent visibility, thermal and RF estimates. Inputs describe an illustrative spacecraft, not a certified mission.</p></div>'+
    compare+
    renderScenarioInfo(comparison?.original||result,comparison?"Original selection":"Selected site")+
    (comparison?.recommended?renderScenarioInfo(comparison.recommended,"Recommended alternative"):"")+
    '<section class="science-info-group science-info-sources"><h4>References</h4>'+
    '<ul>'+
    '<li><a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener noreferrer">JPL Horizons — astronomical geometry</a></li>'+
    '<li><a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noopener noreferrer">NASA LOLA — lunar terrain</a></li>'+
    '<li><a href="https://www.diviner.ucla.edu/science" target="_blank" rel="noopener noreferrer">NASA LRO Diviner — historical temperatures</a></li>'+
    '<li><a href="https://pds-geosciences.wustl.edu/missions/apollo/seismic.htm" target="_blank" rel="noopener noreferrer">Apollo seismic archive — historical data, not a local risk forecast</a></li>'+
    '</ul></section>';
}
