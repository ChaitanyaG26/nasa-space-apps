from datetime import timezone
from backend.horizons import parse_observer_csv,HorizonsError
import pytest
SAMPLE='''JPL Horizons
$$SOE
 2026-Nov-20 12:00,*,m, 89.2350, 1.2451,
 2026-Nov-20 13:00,*,m, 90.2345, -0.2021,
$$EOE
'''
def test_parser_observer():
    x=parse_observer_csv(SAMPLE)
    assert len(x)==2
    assert x[0][0].tzinfo==timezone.utc
    assert x[0][1]==89.235
    assert x[1][2]==-0.2021
def test_parser_bad_response():
    with pytest.raises(HorizonsError):parse_observer_csv('bad request')
