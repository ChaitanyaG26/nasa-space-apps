"""Checks that LUNA uses NASA imagery, not fake crater rings."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def test_globe_nasa_texture():
    text=(ROOT/'luna-mission-control/web/globe.js').read_text()
    assert 'lroc_color_2k.jpg' in text
    assert 'new URL("./assets/lroc_color_2k.jpg",import.meta.url)' in text
    assert 'texture2D(moonColor' in text
    assert 'gl.UNPACK_FLIP_Y_WEBGL,true' in text
    assert 'float craters' not in text
def test_lunar_terminator_uses_solar_incidence():
    """Bright hemisphere follows geometric sunlight; visual ambient is nonphysical."""
    text=(ROOT/'luna-mission-control/web/globe.js').read_text()
    # A sharp physical terminator has incidence=max(dot(normal,sun),0).
    assert 'float incidence=max(dot(n,normalize(sun)),0.0);' in text
    # Faint ambient illumination is for viewing the Moon's dark side,
    # not an assertion that the dark side receives solar power.
    assert 'float brightness=0.075+0.925*sqrt(incidence);' in text
    assert 'smoothstep(-0.30,0.55' not in text
