"""Stage LUNA for GitHub Pages with relative versioned asset URLs."""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "luna-mission-control" / "web"
DEST = ROOT / "_site"
if DEST.exists():
    shutil.rmtree(DEST)
shutil.copytree(SRC, DEST)
html = (DEST / "index.html").read_text(encoding="utf-8")

def relative_asset(match):
    return match.group(1) + '="./' + match.group(2) + (match.group(3) or "") + '"'

html = re.sub(r'(href|src)="/(styles\.css|app\.js)(\?[^"]*)?"', relative_asset, html)
entry = re.search(r'<script type="module" src="\./app\.js(?:\?[^"]*)?"></script>', html)
assert entry is not None, "Versioned app entry point not found"
html = html[:entry.start()] + '<script>window.LUNA_STATIC_SITE = true;</script>\n' + html[entry.start():]
(DEST / "index.html").write_text(html, encoding="utf-8")
(DEST / ".nojekyll").touch()
# Preserve the verified custom domain for the Action-based Pages artifact.
cname = ROOT / "CNAME"
if cname.is_file():
    shutil.copy2(cname, DEST / "CNAME")

# Fail the Pages job if staging silently loses any main-screen control or
# referenced module. Prevent a green deployment with broken/duplicate actions.
assert 'class="mission-toolbar"' in html, "Top toolbar missing from staged page"
for control in ("date", "time", "simulate", "optimize", "preserve", "globe"):
    assert html.count(f'id="{control}"') == 1, f"Missing or duplicate {control} control"
assert "20261114-nasa-playback-graphics-v2" in html, "Stale page asset version"
for module in ("static-engine.mjs", "globe.js", "science-charts.mjs",
               "playback-clock.mjs", "orbit-visualization.mjs", "launch-window.mjs"):
    assert (DEST / module).exists(), f"Missing published {module}"
print("Validated LUNA Pages artifact at", DEST)
