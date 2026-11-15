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
