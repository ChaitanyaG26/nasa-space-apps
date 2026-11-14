"""Stage LUNA as a static GitHub Pages site using relative URLs."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'luna-mission-control'/'web'
DEST=ROOT/'_site'
if DEST.exists():shutil.rmtree(DEST)
shutil.copytree(SRC,DEST)
html=(DEST/'index.html').read_text(encoding='utf-8')
for asset in ('styles.css','app.js'):
    html=html.replace('="/'+asset+'"','="./'+asset+'"')
entry='<script type="module" src="./app.js"></script>'
assert entry in html, 'App entry point not found'
html=html.replace(entry,'<script>window.LUNA_STATIC_SITE = true;</script>\n'+entry.replace('src="./app.js"','src="./app.js?v=20261114b"'))
(DEST/'index.html').write_text(html,encoding='utf-8')
(DEST/'.nojekyll').touch()
assert (DEST/'static-engine.mjs').exists()
assert (DEST/'globe.js').exists()
print('Built LUNA Pages assets at',DEST)
