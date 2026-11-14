from datetime import datetime,timezone
from backend.models import MissionRequest
from backend.science import visible_disk,solar_watts,run_mission
from backend.optimizer import optimize
DT=datetime(2026,11,20,12,tzinfo=timezone.utc)
def req(**kwargs):return MissionRequest(landing_time=DT,duration_days=1,**kwargs)
def test_solar_disk():
    assert visible_disk(-1)==0
    assert visible_disk(1)==1
    assert abs(visible_disk(0)-0.5)<1e-8
def test_power_geometry():
    assert solar_watts(0,90,1,0,0,1)>250
    assert solar_watts(0,0,1,0,0,1)<1e-8
    assert solar_watts(0,90,1,0,0,0)==0
def test_mission_timeline_and_bounds():
    r=run_mission(req())
    assert len(r['samples'])==25
    assert 0<=r['metrics']['min_soc']<=100
    assert 0<=r['metrics']['earth_hours']<=24
    assert r['quality']['terrain'].startswith('FLAT HORIZON')
def test_fixed_site_optimizer():
    r=optimize(req(),preserve='site')
    assert r['recommended']['site']==r['original']['site']
    assert r['recommended']['landing_time']!=r['original']['landing_time']
    assert '±14 days' in r['search']
def test_fixed_time_optimizer():
    r=optimize(req(),preserve='time')
    assert r['recommended']['landing_time']==r['original']['landing_time']
    assert r['recommended']['site']!=r['original']['site']
def test_invalid_time_zone():
    import pytest
    with pytest.raises(ValueError):MissionRequest(landing_time=datetime(2026,11,20,12))
