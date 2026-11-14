"""GitHub Pages branch publishing must display the app, never the README."""
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path(__file__).resolve().parents[2]
class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=="script" and "src" in attrs:self.urls.append(attrs["src"])
        if tag=="link" and "href" in attrs:self.urls.append(attrs["href"])
def test_root_github_pages_homepage():
    page=(ROOT/"index.html").read_text(encoding="utf-8")
    assert '<canvas id="globe"' in page
    assert "window.LUNA_STATIC_SITE = true" in page
    assert page.index("window.LUNA_STATIC_SITE = true")<page.index('src="./luna-mission-control/web/app.js"')
    parser=Assets()
    parser.feed(page)
    assert "./luna-mission-control/web/styles.css" in parser.urls
    assert "./luna-mission-control/web/app.js" in parser.urls
    for url in parser.urls:
        assert not url.startswith("/"), "Absolute asset URL breaks project Pages"
        assert (ROOT/url).is_file(), f"Missing public asset: {url}"
def test_static_simulator_modules_present():
    app=(ROOT/"luna-mission-control/web/app.js").read_text(encoding="utf-8")
    assert 'import {staticApi,simulateWithGeometry,optimizeWithEngine} from "./static-engine.mjs"' in app
    assert 'import {loadJplReference,referencePreview,geometrySeries} from "./horizons-static.mjs"' in app
    assert 'if(IS_PAGES){' in app
    assert 'return staticApi(path,data)' in app
    assert 'if(selected==="horizons")' in app
    for name in ("static-engine.mjs","globe.js"):
        assert (ROOT/"luna-mission-control/web"/name).exists()
