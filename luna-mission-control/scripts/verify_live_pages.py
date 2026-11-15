"""Verify a published GitHub Pages release over HTTP, not just the uploaded artifact.

Usage: python verify_live_pages.py https://lunacontrol.earth/
Checks the landing page and actual served JavaScript/CSS; retries while the
Pages CDN updates. Non-zero exit blocks a falsely green deploy verification.
"""
import html.parser
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

RELEASE = "20261114-scroll-top-v20"


class Assets(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.styles = []
        self.ids = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if "id" in attributes:
            self.ids.append(attributes["id"])
        if tag == "script" and attributes.get("type") == "module":
            self.scripts.append(attributes.get("src", ""))
        if tag == "link" and attributes.get("rel") == "stylesheet":
            self.styles.append(attributes.get("href", ""))


def fetch_text(url):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "LUNA-GitHub-Pages-Deployment-Check/1.0",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}: {url}")
        return response.read().decode("utf-8")


def fresh(url):
    token = str(int(time.time() * 1000))
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}luna_check={token}"


def verify(base_url):
    if not base_url.startswith("https://"):
        raise ValueError("Site URL must be HTTPS")
    page = fetch_text(fresh(base_url))
    if 'class="mission-toolbar"' not in page:
        raise AssertionError("Live page missing top-of-globe mission toolbar")
    if '<body class="sidebar-layout">' not in page:
        raise AssertionError("Published LUNA site does not use a left vertical sidebar")
    aside = page.split("</aside>", 1)[0]
    if '<nav class="mission-toolbar"' not in page:
        raise AssertionError("Missing top simulation action bar")
    actions = page.split('<nav class="mission-toolbar"', 1)[1].split("</nav>", 1)[0]
    if actions.count("<button ") != 3 or 'id="restartMission"' not in actions or 'id="optimizeMenu"' in actions:
        raise AssertionError("Top bar must include immediate compare and restart controls")
    for name in ("date", "time", "duration", "orbital", "horizon",
                 "area", "battery", "load", "reserve"):
        if f'id="{name}"' not in aside:
            raise AssertionError(f"{name} must remain in left sidebar")
    for name in ("simulate", "optimize", "restartMission"):
        if f'id="{name}"' not in actions:
            raise AssertionError(f"{name} must remain in top action bar")
    parser = Assets()
    parser.feed(page)
    for element_id in ("date", "time", "simulate", "optimize", "restartMission", "globe"):
        if parser.ids.count(element_id) != 1:
            raise AssertionError(f"{element_id}: expected one control, found {parser.ids.count(element_id)}")

    if len(parser.scripts) != 1 or len(parser.styles) != 1:
        raise AssertionError("Expected one module entry and one stylesheet")
    module_path, css_path = parser.scripts[0], parser.styles[0]
    if RELEASE not in module_path or RELEASE not in css_path:
        raise AssertionError("Live HTML still serves an older asset version")
    module_url = urllib.parse.urljoin(base_url, module_path)
    css_url = urllib.parse.urljoin(base_url, css_path)
    app = fetch_text(fresh(module_url))
    css = fetch_text(fresh(css_url))
    if "setChartsCursor" not in app or "metric-sequence" in app or "playEphemeris" in app:
        raise AssertionError("Live app.js still includes removed chart counters or sky playback controls")
    if ".mission-toolbar" not in css or ".vehicle-readout" not in css:
        raise AssertionError("Live stylesheet lacks updated mission and vehicle controls")
    # Probe external modules independently; client-side lazy loading would not
    # otherwise reveal missing deployment artifacts in the landing-page response.
    library_dir = urllib.parse.urljoin(module_url, "./")
    modules = {
        "science-charts.mjs": "extremaPath",
        "playback-clock.mjs": "advancePlaybackUtc",
        "orbit-visualization.mjs": "distanceOnEarthMoonView",
        "vehicle-performance.mjs": "assessVehicle",
        "horizons-geocentric.mjs": "geocentricAt",
        "landing-sites.mjs": "HISTORIC_LANDING_SITES",
        "lunar-limb-halo.mjs": "haloLimbStrength",
        "mobile-scenario-layout.mjs": "arrangeScenarioPanels",
        "moon-sky-3d.mjs": "createMoonSky3D",
        "mission-surface-3d.mjs": "loadMoonSiteGrid",
        "usgs-3dep.mjs": "decodeFloatTiff",
        "terrain-3d.mjs": "terrain-info",
    }
    for filename, expected in modules.items():
        url = urllib.parse.urljoin(library_dir, filename)
        body = fetch_text(fresh(url))
        if expected not in body:
            raise AssertionError(f"{filename} missing expected simulation code")
    print(f"LIVE VERIFIED: {base_url} - current toolbar, JS and CSS assets are served")


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://lunacontrol.earth/"
    errors = []
    for attempt in range(1, 7):
        try:
            verify(url)
            break
        except (AssertionError, ValueError, urllib.error.URLError,
                RuntimeError, UnicodeDecodeError) as exc:
            errors.append(f"Attempt {attempt}: {type(exc).__name__}: {exc}")
            print(errors[-1], file=sys.stderr)
            if attempt == 6:
                raise SystemExit("Live deployment verification failed after retries")
            time.sleep(5)
