# LUNA Mission Control — GitHub prototype

**GitHub Pages:** A static, browser-only version of LUNA is published from `web/` by the GitHub Actions workflow in `.github/workflows/luna-pages.yml` once Pages is enabled. It runs the offline demonstrator without a Python server. See [GitHub Pages and Porkbun deployment](DEPLOY_GITHUB_PAGES.md). Live JPL Horizons API calls require separate backend hosting.


Interactive Moon landing-site explorer with a **sidebar-only** Sun/Earth viewer, date/time controls, and mission parameters. The right side shows the Moon globe until **Simulate mission** is clicked; it then switches to results, and **Optimize & compare** displays original and alternative scenarios side by side.

## Run locally

Python 3.11+ is required. No Node.js or frontend build is required.

~~~bash
cd luna-mission-control
python -m venv .venv
source .venv/bin/activate             # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pytest -q
python -m uvicorn backend.app:app --reload
~~~

Visit http://127.0.0.1:8000 and interactive API docs at http://127.0.0.1:8000/docs.

## Manual smoke test

1. Drag/zoom the Moon, click a point, and check the selected coordinates update in the sidebar.
2. Change UTC date and time; watch sidebar Moon-centered and horizon geometry previews update.
3. Leave offline illustrative mode selected. Click **Simulate mission**; the globe is replaced by charts.
4. Choose **Keep landing date/time** and click **Optimize & compare**; two scenario columns appear.
5. Choose **Keep landing site** and repeat; alternative dates are sampled every 12 hours in ±14 days.
6. Click **Return to globe** to return to map selection.

## Science fidelity — read before demo

- **Offline geometry is illustrative**, not JPL-validated astronomical positions. This mode is provided for testing without network access.
- The JPL Horizons code fetches Sun and Earth observer azimuth/elevation, but real API connectivity must be verified separately. The NASA path uses reference-surface height zero; the correct terrain datum integration is pending.
- **Terrain horizon is flat (0°)**: no NASA LOLA DEM, crater obstruction, safe landing slope, or rover traversal analysis is implemented.
- **Solar generation** uses fixed panel orientation, approximate solar disk visibility, constant irradiance, 24% cell efficiency and 80% system efficiency.
- **Battery SOC** follows simplified energy integration; no thermal/heating constraints are included.
- **Temperature is an explicitly unvalidated proxy**, not projected spacecraft component temperature or a hibernation recommendation.
- Earth-center elevation above a flat horizon is geometric visibility, **not a guaranteed communications link**.
- Site optimization uses an **illustrative 11-site polar grid** with no landing-site vetting. Time optimization samples ±14 days in 12-hour increments. True NASA/terrain-aware optimization requires ephemeris + LOLA caches.
- No spatially grounded seismic information is available in this prototype.

Sources: [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [NASA LOLA PGDA](https://pgda.gsfc.nasa.gov/products/78).

## Deployment

The FastAPI application serves the static interface and JSON APIs together. Deploy the Dockerfile with the working directory set to **luna-mission-control** (for example on a container hosting provider). Do not put API secrets in source control. GitHub Actions runs the Python test suite for changes in this folder.

## Repository layout

~~~text
luna-mission-control/
  backend/
    app.py           API and frontend file routes
    models.py        validated UTC and mission parameters
    science.py       offline/astronomical scenario simulation
    horizons.py      live JPL Horizons query and parser
    optimizer.py     preserve-one-variable what-if search
  web/
    index.html       left sidebar and two main screens
    styles.css       responsive dark mission-control theme
    globe.js         selectable WebGL sphere with procedural surface
    app.js           UI state, API calls, results, comparisons
  tests/             API, science and parser tests
  requirements.txt
  Dockerfile
~~~

### Implementation priority

Integrate NASA LOLA elevation tiles and site-specific terrain horizons first; then cache validated Horizons ephemerides, extend the candidate list to scientifically screened locations, and implement physics-grounded temperature modeling and uncertainty labels.

The visual globe is a procedural Moon representation (not NASA texture) and cannot be used to infer local slopes or landing safety.

### Moon-fixed vs site-local coordinates

The first sidebar mini-widget represents Moon-fixed **directions** toward Sun and Earth (not scaled orbits). At constant UTC time, changing landing sites does not change these global directions. The second mini-widget uses site-specific local north-clockwise azimuth and elevation, which *do* change with the chosen location. Global Moon lighting also uses the Moon-fixed Sun direction, so moving the landing marker cannot change the illuminated hemisphere. Browser-only global values are illustrative, not NASA Horizons-validated.

### Public JPL Horizons default (GitHub Pages)

The ephemeris selector now defaults to **NASA JPL Horizons (cached reference)**. GitHub Pages cannot host Python and NASA's SSD API is not meant for direct public-browser embedding. The GitHub Actions workflow `.github/workflows/luna-horizons-cache.yml` queries Horizons from a server-side Python job and saves a compact JSON file in `web/assets/horizons-moon-reference.json`.

The published cache is generated from a **fixed lunar equatorial reference observer** (latitude 0°, east longitude 0°, height 0) and is transformed into Moon-fixed direction vectors. Browser calculations project those vectors into local azimuth and elevation for selected sites. This is **an approximation, not direct JPL Horizons observer output for each selected site**; Earth parallax, near-horizon clearance, and communication windows can deviate from site-specific Horizons output. Never use this as a flight-ready site ranking. Terrain remains flat until LOLA is incorporated. It is important that JPL reference data never silently falls back to the offline demo when missing.

The initial dataset covers **2026-10-01 through 2027-03-01 UTC**, sampled every three hours and interpolated between samples; adjust the generator dates to extend coverage. A missing cache or out-of-range date generates a visible error. The offline illustrative mode remains an explicit opt-in. After merging, check that the cache workflow succeeds and publishes the JSON before testing JPL mode.

### Measured Horizons range & site parallax (cache schema v2)

The NASA cache now uses `QUANTITIES=4,20` to obtain local azimuth/elevation and topocentric distance (AU) for both Sun and Earth. At the known lunar reference site, the generator reconstructs Moon-centered Cartesian target positions in kilometers. Each selected site's observer vector is subtracted before computing local azimuth/elevation. This captures the dominant **Earth parallax** that the previous site-independent direction approximation omitted. A sample remains interpolated every three hours. Differences from an actual site-specific Horizons query (light-time/aberration handling, elevation datum, and DEM horizon) remain and are not mission-certification precision. The cache is generated automatically on GitHub and versioned as schema 2; the website rejects incompatible schema 1 rather than using old approximation data.

### NASA LOLA terrain elevations (regional and measured)

The public website includes gridded NASA LOLA topography sourced from NASA SVS's CGI Moon Kit (`ldem_16.tif`, 16 pixels/degree, in kilometers above the 1737.4 km reference sphere). A GitHub Action crops the **south polar 75°S–90°S** region and averages it to **0.25° angular cells** for compact GitHub Pages delivery. Surface elevation is used to adjust observer radius in the Moon-fixed parallax geometry and is shown for each site in previews and mission cards. **It does NOT establish local horizon blockage, 5 m slope hazards, rover traversal, seismic activity, or landing safety.** The meridional pixel resolution is approximately 7.6 km; those tasks need higher-resolution LOLA products. The website makes no terrain visibility claim yet.

Source: https://svs.gsfc.nasa.gov/4720/ . High-resolution polar DEMs: https://pgda.gsfc.nasa.gov/products/78 .

### Date/time and data freshness

The Horizons browser module accepts timezone-qualified ISO UTC strings, JavaScript Date objects, and numeric epoch-millisecond timestamps (the latter are used for every hourly simulation sample). A regression test exercises a seven-day mission from **2026-12-09T03:20:00Z**, **53.716°S, 64.389°W**, including missing LOLA coverage at that latitude. The NASA Horizons generator now produces 1-hour reference samples rather than 3-hour samples, while the browser computes results at the same hourly simulation cadence. The root Pages entrypoint and GitHub Actions build include a versioned script URL so visitors don't continue running an outdated, incompatible browser module. The data is cached and interpolated; exact-site Horizons observer queries are still not performed in the browser.


### Phase II — NASA measurements and remaining model assumptions

Global elevation is sourced from the NASA GSFC SVS CGI Moon Kit LOLA GDR (ldem_16.tif): https://svs.gsfc.nasa.gov/4720/ . The build_lola_global.py pipeline creates a 2x2-averaged **8 pixels/degree whole-Moon elevation raster**, preserving SHA256 source provenance and storing half-meter quantized heights relative to the 1737.4 km lunar reference sphere. Output resolution is approximately 3.8 km north-south. The browser estimates a 72-bearing regional skyline out to 120 km with lunar curvature; near-field obstructions and individual rover obstacles are **not resolvable** at this scale. The Sun/Earth windows are regional estimates, not guaranteed site line of sight.

NASA/JPL Horizons positions supply Sun/Earth directions and range; irradiance uses the measured Sun distance via the inverse square rule and a reference 1361 W/m² at 1 AU. The 24% panel conversion, 80% electrical factor, user panel tilt/azimuth, battery capacity and power load are design assumptions rather than measured hardware.

The former thermal curve was an unvalidated proxy. It has been removed: NASA Diviner measures regolith temperatures, not an unspecified lander's components. No temperature or hibernation forecast is reported without a thermal balance model including radiation, conduction, internal heat and mass/thermal inertia. The app still does not predict seismic risk or centimeter-/meter-scale rover traversability. Geometric Earth visibility is not a radio link budget; communication service is not guaranteed by the view alone.


### Phase II: Restore all scenario graphs, without mislabeling projections

The UI includes solar power, battery state of charge, geometric Earth communication opportunities, **projected regolith temperature** and **power conservation advisory** (a screening indicator rather than a validated need for hibernation). The thermal graph is NOT a measured lander or even an independently validated site-specific soil forecast. It uses radiative equilibrium:
\(T=(T_\mathrm{background}^4+[(1-a) S \sin(\mathrm{Sun\ elevation}) f_\mathrm{sun}]/(\epsilon\sigma))^{1/4}\).
It references NASA LRO Diviner's observed thermal ranges (roughly below 100 K at lunar night and around 400 K in equatorial daytime), but 0.12 albedo, 0.95 emissivity and a 95 K background are **assumptions**. Thermal inertia, shadowed polar cold traps, local reflection, emission from nearby terrain, subsurface conduction, solar geometry/roughness and actual hardware thermal design are not represented. The output label always says **PROJECTED — NOT SITE-VALIDATED**. Solar energy, battery SOC and communication windows are also **PROJECTED** and depend on user hardware assumptions; no radio link budget or rover safety evaluation is claimed. A low-power advisory appears if the assumed battery SOC is within 10 percentage points of the user's reserve and projected instantaneous solar output is lower than assumed load.

NASA data and research references:
- JPL Horizons: https://ssd.jpl.nasa.gov/horizons/
- LOLA global surface height raster: https://svs.gsfc.nasa.gov/4720/
- LRO Diviner measurements and science: https://www.diviner.ucla.edu/science and archive https://pds-geosciences.wustl.edu/missions/lro/diviner.htm
- Apollo lunar seismic archive (context only, **not** local seismic prediction): https://pds-geosciences.wustl.edu/missions/apollo/seismic.htm

Validation status: JavaScript unit/integration tests verify model equations, JPL data time interpolation, NASA LOLA grid shape, energy bounds and labels. Independent validation against site-specific Diviner temperatures or a flight lander's telemetry is **not** yet available. Do not use these outputs for operational mission decisions.
