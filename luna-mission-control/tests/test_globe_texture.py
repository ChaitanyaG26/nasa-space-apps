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
def test_lighting_not_black():
    text=(ROOT/'luna-mission-control/web/globe.js').read_text()
    assert 'float brightness=0.50+0.50*daylight' in text
    assert 'smoothstep(-0.30,0.55' in text
