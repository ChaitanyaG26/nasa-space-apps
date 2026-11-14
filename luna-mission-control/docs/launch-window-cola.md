# Launch Window & COLA — educational extension

This module appears **below the existing simulation graphs**, after a lunar site/date scenario is generated.

## What it provides

- A deliberately limited selection of three major U.S. orbital launch locations: **Cape Canaveral Space Force Station**, **Kennedy Space Center (LC-39)**, and **Vandenberg Space Force Base**. Current range and vehicle eligibility must be confirmed with the operators; none is presented as a preapproved lunar launchpad.
- Approximate geocentric lunar coordinates from a truncated analytical Moon theory, and an idealized Earth-centered, impulsive Hohmann-like transfer from circular low Earth orbit to the approximate lunar distance.
- Departure-time samples centered on the user-selected lunar **arrival** time, with a simple arrival-time and Moon-bearing alignment **heuristic**, a transfer time and TLI ΔV estimate.
- Optional manual entry of *officially sourced* COLA hold intervals in UTC. Candidate times inside those intervals are suppressed. A time outside those intervals remains **NOT VERIFIED**.
- A reserved placeholder for a future Higgsfield animation, with **no generated video** or live Higgsfield integration.

## Launch-site acknowledgement

The three selected locations are major U.S. launch ranges used for orbital missions. Many other NASA-associated sites primarily support sounding rockets, suborbital research, smaller vehicles, or specialized missions, although additional facilities also conduct orbital launches. The app's three-site selector is a deliberate educational simplification, not a complete inventory of U.S. or international launch capability.

## Science and operational restrictions

This is not a solved or numerically targeted Earth–Moon trajectory. It does not implement Lambert targeting, n-body propagation, lunar orbit insertion, surface-site targeting, vehicle propulsion/staging, departure-plane constraints, aerodynamic ascent, range safety, ground track, launch corridor, weather, licensed launch operations, or injection timing from actual launch vehicle performance.

NASA Collision On Launch Avoidance (COLA) is an operational launch-safety process. No authoritative conjunction catalog, time-dependent debris covariance, ISS ephemeris, range-run launch trajectory, or certified launch hold times are available in this module. The application **never claims COLA clearance**. A launch cannot be called safe based on these calculations.

The position model is a deliberately simplified lunar ephemeris; it is *not* the JPL Horizons dataset used by the main lunar surface simulator and should not inherit the main simulator's NASA validated labels.

## Usage

1. Select a lunar site/date and click **Simulate mission**.
2. Scroll beneath the result graphs to **Launch Window & COLA**.
3. Choose a representative launch range, LEO parking altitude, and search interval.
4. Optionally paste UTC holds as `start,end` on separate lines (example `2026-11-20T00:00Z,2026-11-20T01:00Z`).
5. Click **Evaluate preliminary launch windows**.
6. Review the timing candidates as **educational geometry illustrations**, never operational launch recommendations.

## Code and tests

- Browser module: `web/launch-window.mjs`
- CSS: `web/styles.css`
- Imported into the existing `web/app.js` and served by FastAPI route `/launch-window.mjs`.
- Node tests: `tests/launch-window.test.mjs`; included in GitHub Pages CI.

## References

- NASA Launch Services Program — https://www.nasa.gov/kennedy/launch-services-program/launch-services-program-launch-sites/
- NASA Sounding Rocket launch locations — https://www.nasa.gov/soundingrockets/launch-locations/
- NASA Conjunction Assessment Risk Analysis (CARA) — https://www.nasa.gov/cara/
- FAA launch and reentry collision avoidance regulatory references — https://www.faa.gov/space
