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
assert (DEST / "static-engine.mjs").exists()
assert (DEST / "globe.js").exists()
print("Built LUNA Pages assets at", DEST)
