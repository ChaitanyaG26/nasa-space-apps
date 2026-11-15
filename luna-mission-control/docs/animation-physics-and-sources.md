# LUNA animation physics and data provenance

## Fidelity tiers

| Scene or feature | Physical/data basis | Limits |
| --- | --- | --- |
| Selected-site sky + horizon | NASA/JPL Horizons lunar reference cache; site-parallax correction; NASA LOLA terrain | Not a direct Horizons query at every selected site; high-resolution LOLA coverage varies |
| Earth–Moon 3D transfer | Analytic Earth-centered two-body Kepler time-of-flight, vis-viva energy, arrival distance; NASA JPL geocentric Moon/Sun ICRF vectors when cached | No real vehicle launch/ascent state, lunar gravity, lunar orbit insertion, landing-target intersection, multibody targeting, or COLA certification |
| Moon and Sun movement | NASA/JPL Horizons geometric state vectors (ICRF Earth center), hourly cached October 2026–March 2027; cubic Hermite interpolation with stored velocities | Outside cache coverage reverts to clearly labeled lower-precision analytic Moon/Sun directions; not a full SPICE spacecraft ephemeris |
| Lunar globe | NASA CGI Moon Kit/LROC map, lunar sphere mesh; solar angle-based day/night shading | Display-only ambient lighting brightens nightside; it does **not** mean sunlight or electrical power in darkness |
| Rocket ascent and payload check | Published launch vehicle dimensions; public fueled mass, liftoff thrust and LEO capacity where available; user-entered payload; simplified vertical kinematic sensitivity | Published fueled mass may already include a standard payload; no variable propellant mass flow, staging, drag, gravity changes, actual upper-stage performance, TLI deliverability or mission authorization. Missing public values remain unknown, not fabricated |
| Probe terminal descent | NASA surface gravity 1.62 m/s²; constant net deceleration from an explicitly assumed 180 m height, 14 m/s downward initial speed to 0.8 m/s at touchdown | NOT a full powered descent guidance/nav/flight simulation; no propellant mass flow, dynamic thrust, control authority, uncertainty, or hazard avoidance |
| Lunar descent terrain | NASA LOLA 20-meter polar patch samples along an east-west cross section at the selected lunar coordinates, where coverage exists | 2× vertical exaggeration and separately scaled descent height; no boulders or sub-20-m hazards. Missing DEM displays as unknown, not safe |
| Public catalog context | CelesTrak OMM subset with timestamp and epoch warnings | This is not a full debris catalog, nor object propagation, collision probability, or authorized COLA screening |

### Descent model

Let the descent be a *terminal* segment with initial altitude \(h_0=180\) m,
initial downward velocity \(v_0=14\) m/s, touchdown vertical velocity \(v_f=0.8\) m/s,
and assumed lunar gravity \(g_{\rm Moon}=1.62\) m/s² (NASA Moon Fact Sheet).

The simplest constant-net-deceleration kinematic trajectory is:

- Duration \(T=2h_0/(v_0+v_f)\).
- Net downward acceleration \(a_d=(v_f-v_0)/T\) (negative means net upward).
- Height above ground \(h(t)=h_0-v_0 t-\tfrac12 a_d t^2\).
- Downward speed \(v(t)=v_0+a_d t\).
- Required engine acceleration in the ideal vertical single-body model
  \(a_{\rm thrust}=g_{\rm Moon}-a_d\); thrust-to-weight acceleration ratio
  \(a_{\rm thrust}/g_{\rm Moon}\).

The animation is a **kinematic depiction of the last 180 m only**.
It is not a lander propulsion design. Animation time, heights and vertical
speeds are consistent with these chosen assumptions, which should be shown
in the on-screen telemetry.

### Earth–Moon model

The 3D transfer is a two-body perigee-to-apogee arc from a selected Earth
parking-orbit radius to an estimated Earth–Moon radius. Its numeric speed is
calculated using vis-viva \(v=\sqrt{\mu(2/r-1/a)}\). The arc orientation is
chosen so the spacecraft's model apogee visually coincides with the Moon
center at the displayed arrival time, and Moon position is animated using
its actual JPL ephemeris when available. The physical Moon's gravitational
pull would deflect the real spacecraft before the model reaches that point.
Do **not** label the result a solved flight path or certified intercept.
The visual Earth–Moon separation uses a **linear distance scale**. Earth/Moon
disc radii are enlarged for readability, and the Sun is *not* drawn in the
same spatial panel: JPL's Sun direction is indicated at the edge, with actual
Earth–Sun distance in the model readout (~149.6 million km versus ~384,400 km
for the Moon). Rocket or payload mass does not change the unpowered two-body
coast; it affects powered flight feasibility, which is **not** solved by this
mission-planning teaching tool.

### Launch vehicle reference check

Users can enter payload mass for each original or optimized launch scenario.
When a public manufacturer value exists, LUNA displays approximate liftoff
thrust, a gross launch-mass sensitivity proxy, and an initial thrust-to-weight
*proxy*. A separate LEO-capacity comparison helps identify implausibly heavy
payloads. **None** of these is a verified translunar payload capability:
actual launch performance requires the exact vehicle variant, upper stage,
staging, throttle, trajectory, fuel allocation and safety clearance. For
missing manufacturer specifications, the app displays unavailable values
rather than inventing parameters.

### Source links

- NASA/JPL Horizons API: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- NASA Moon gravity and mean radius: https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
- NASA Lunar Reconnaissance Orbiter CGI Moon Kit: https://svs.gsfc.nasa.gov/4720/
- NASA LOLA lunar digital elevations: https://pgda.gsfc.nasa.gov/products/81
- SpaceX Falcon 9 dimensions: https://new.spacex.com/vehicles/falcon-9
- NASA SLS dimensions: https://www.nasa.gov/reference/space-launch-system/
- ULA Vulcan dimensions: https://www.ulalaunch.com/docs/default-source/rockets/vulcancentaur.pdf
- Firefly Alpha dimensions: https://fireflyspace.com/alpha/
- NASA conjunction-assessment overview: https://www.nasa.gov/cara/

The use of NASA scientific data does **not** make a vehicle trajectory flight-ready.
Formal launch collision avoidance additionally requires official conjunction
screening and restricted tracking/uncertainty data. LUNA never reports
collision-free status from public catalogs.


## 2026 three-scenario and visual-terrain extension

### Simultaneous original and two independent optimizations

Selecting **Optimize & Compare** now runs two **independent** scientific-engine searches against the original mission:

1. Original site, UTC date and hardware assumptions.
2. **Date fixed; location optimized.** Same UTC landing date, alternate locations from the small demonstrator south-pole search grid.
3. **Location fixed; date optimized.** Same input site, alternative UTC dates sampled over ±14 days in 12-hour increments.

All three scenarios have their own plots, terrain explorer and Earth–Moon conceptual transfer and launch-range/COLA panels. The demonstration grid is neither exhaustive nor certified for safe landing. Any "recommended" alternative is a ranking under stated battery and communication assumptions, **not** a mission readiness claim.

### Threshold communication chart

The eighth graph is now **Earth terrain clearance** (degrees). Each plotted point follows

\[
\mathrm{clearance}(t) = \mathrm{EarthCenterElevation}(t) - \mathrm{LOLAHorizon}(\mathrm{EarthAzimuth}(t)).
\]

Positive clearance is highlighted teal/green; zero or negative clearance remains neutral. This identifies a necessary **geometric** condition for direct-to-Earth line-of-sight, **not** a guarantee of communications. It does not include relay satellites, antenna pointing, link margin or terrestrial ground-station schedules. If the LOLA horizon is unavailable, the model falls back to an unobstructed spherical horizon and must **not** present the result as site-verified.

### Historical lunar landing markers

The 3D Moon globe displays thirteen *documented* touchdown locations: Apollo 11/12/14/15/16/17 (NASA), Chang'e 3/4/5/6 (CNSA), Chandrayaan-3 (ISRO), IM-1 Odysseus (Intuitive Machines) and Blue Ghost Mission 1 (Firefly). Marker colors indicate operator/organization. UTC touchdown times are provided only when verified; otherwise the date is shown with an "exact UTC time unverified" label. A marker click selects the mission's published coordinates in the LUNA globe.

- Apollo coordinates: https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html
- Apollo UTC touchdown times: https://www.nasa.gov/wp-content/uploads/2023/10/south-pole.pdf and https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo17info.html
- Chang'e coordinates: https://cosparhq.cnes.fr/assets/uploads/2024/09/COSPAR-PPP-2024-Overview.pdf
- Chandrayaan-3 coordinates/time: https://www.nasa.gov/wp-content/uploads/2026/02/42-240a.pdf
- IM-1 coordinates/time: https://ntrs.nasa.gov/api/citations/20250007036/downloads/aasimndl.pdf
- Blue Ghost time/location: https://www.nasa.gov/news-release/touchdown-carrying-nasa-science-fireflys-blue-ghost-lands-on-moon/

### Rotatable 3D surface scenes — new fidelity and caution

The user-selected Earth range is sampled from **Mapzen / AWS Open Terrain Tiles** in Terrarium-encoded elevation PNG format (30-ish-meter global tiles, heterogeneous providers). Decode in meters: \((R\times 256 + G + B/256)-32768\). This is **not a verified pad survey**, and the selected range coordinates are *reference coordinates*, not exact approved launch-pad coordinates. Tile availability and CORS depend on public infrastructure. If a tile is blocked, partial or absent, LUNA labels elevation **unavailable** and draws a flat coordinate reference instead of inventing hills.

Source: https://www.mapzen.com/blog/terrain-tile-service/

The lunar descent now samples a 23×23 **NASA LOLA polar DEM** grid over a 440-meter footprint around the scenario's selected landing coordinates. A valid 20 m polar patch is required for the measured terrain claim. The 3D terrain display and lander body can be rotated and zoomed independently. The vehicle's position is still a separately labelled model trajectory:
- generic vehicle vertical ascent kinematics with manufacturer mass/thrust sensitivity where available;
- 180 m lunar terminal descent using \(g=1.62\,\mathrm{m/s^2}\), assumed initial and final downward speeds, and constant net acceleration.

To keep the entire 180 m descent and the high-altitude ascent visible inside a compact graphic, their **display height is compressed**. Terrain elevation is rendered in native meter differences relative to the local center sample. The on-screen altitude/speed numbers, not the screen pixels, represent the model's state. These scenes still omit full vehicle/lander dynamics, terrain-relative autopilot, weather/drag, lunar plume interactions, surface hazards finer than DEM resolution and official launch clearance.

### 3D Moon-fixed directions

The small left-sidebar Moon sky viewer uses the same NASA-derived Moon-fixed unit vectors already used in the forecast (Sun and Earth). The user can rotate the camera; the markers are **directions**, not fictitious Sun/Earth distances or radio geometry. This representation deliberately omits the extreme physical distances to preserve legibility. The adjacent terrain horizon is the relevant site-specific angular obstruction calculation.

### Chart help and additional plots

Each of the original eight charts has an on-demand information icon explaining the metric, its relevance to the mission and how to read it. Subtitles and duplicate min/max captions are hidden by default for compactness. **No ninth or tenth graph has been added in this release**: the old binary Earth visibility ribbon was replaced by the continuous, 0°-threshold Earth clearance plot. Extra graphs should only be added if they introduce independent, scientifically supported decision information.


## Scenario-specific JPL geometry and solar-lit 3D scenes

The orbit viewer now samples Moon geometry **at each frame's UTC time** from
the JPL Horizons geocentric ICRF state-vector cache. The simulated spacecraft
uses an idealized Earth-centered two-body coast arc oriented toward the Moon's
position **at that scenario's arrival UTC**. The Sun is a directional reference,
not a nearby object. When the JPL vector cache is unavailable or a scenario is
outside coverage, an analytic approximation is explicitly identified.

Changing the arrival date can change the displayed Moon location, Sun
direction, arrival-aligned transfer arc, and travel time. **Changing only the
surface landing site at an identical UTC does not physically change the
geocentric Earth–Moon geometry**; site-specific terrain, illumination and
communications results differ separately. No fake geocentric trajectory
variation is introduced merely to differentiate scenarios.

### Solar lighting

The launch scene uses the scenario's departure UTC plus elapsed modeled ascent
seconds. It combines the cached NASA/JPL Earth-centered Sun ICRF vector with
a Greenwich sidereal rotation to approximate the Sun's geometric azimuth and
elevation at Kennedy, Cape Canaveral or Vandenberg. The technique ignores
UT1 corrections, atmospheric refraction and local skyline occlusion and is
**not** an operational launch-pad sunlight calculation.

The descent scene uses the established NASA/JPL Moon-centered Sun geometry,
including selected-site parallax, at the selected scenario's lunar arrival UTC
minus the remaining seconds of the 180-meter terminal descent. The Earth
sidereal formula is not used for the Moon.

For both scenes, terrain-cell normals estimated from the elevation grid and
vehicle-face normals determine approximate Lambertian lighting:

    brightness = ambient + diffuse * max(0, dot(surfaceNormal, sunDirection))

When the Sun is above the geometric horizon, an elongated object shadow is
projected opposite its azimuth. Its horizontal length is approximately
object height divided by tangent(solar elevation), limited to the viewport.
A directional Sun disk/glow provides orientation. These are **visual lighting
cues**, not a ray-traced terrain self-shadowing or hardware thermal analysis.
A neutral fill is used when JPL data are missing; a nighttime fill does not
mean the terrain is receiving sunlight.

Launch, orbit, and landing controllers now share the scenario's departure/
arrival UTC. Selecting a candidate departure resynchronizes all three.
The tests cover UTC-dependent frame geometry, local solar angles, lit/unlit
shadows and a physically correct shadow-length relationship.

The transfer, ascent and landing models remain educational and do not provide
a certified trajectory, safe landing guidance, or formal COLA clearance.
