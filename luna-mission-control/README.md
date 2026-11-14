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
