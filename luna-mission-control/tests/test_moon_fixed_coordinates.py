from datetime import datetime,timezone,timedelta
from math import asin,cos,radians,sin,degrees,hypot
from backend.science import moon_fixed_demo,demo_geometry,moon_fixed_direction_from_local,preview
from backend.models import MissionRequest

T=datetime(2026,11,20,12,tzinfo=timezone.utc)

def req(lat,lon,time=T):
    return MissionRequest(landing_time=time,latitude=lat,longitude=lon,duration_days=1)

def test_global_independent_of_site():
    a=preview(req(-89.5,0))
    b=preview(req(-88.0,110))
    assert a['global']==b['global']
    assert (a['sun_az'],a['sun_el'])!=(b['sun_az'],b['sun_el'])

def test_global_changes_with_time():
    a=preview(req(-89.5,0,T))
    b=preview(req(-89.5,0,T+timedelta(days=2)))
    assert a['global']['sun']!=b['global']['sun']
    assert a['global']['earth']!=b['global']['earth']

def test_local_matches_global_radial():
    lat,lon=-89.5,35.0
    fixed=moon_fixed_demo(T)
    local=demo_geometry(lat,lon,T)
    p,l=radians(lat),radians(lon)
    up=(cos(p)*sin(l),sin(p),cos(p)*cos(l))
    for body in ('sun','earth'):
        v=fixed[body]
        expected=degrees(asin(sum(a*b for a,b in zip(up,(v['x'],v['y'],v['z'])))))
        assert abs(expected-local[body+'_el'])<1e-8

def test_azimuth_to_global_reference_basis():
    vec=moon_fixed_direction_from_local(90,0,0,0)
    assert abs(vec['x']-1)<1e-10
    assert abs(vec['y'])<1e-10
    assert abs(vec['z'])<1e-10
