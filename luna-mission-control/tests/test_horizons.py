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

def test_range_parser_in_jpl_quantities_4_20():
    from backend.horizons import AU_KM
    text='''$$SOE
 2026-Nov-20 12:00,*,m,89.2350,1.2451,2.550000E-03,-0.20,
 2026-Nov-20 13:00,*,m,90.2345,-0.2021,2.560000E-03,0.04,
$$EOE'''
    rows=parse_observer_csv(text,include_range=True)
    assert rows[0][1]==89.235
    assert rows[0][2]==1.2451
    assert abs(rows[0][3]-0.00255*AU_KM)<0.01
    assert len(rows[0])==4

def test_combined_columns_not_accidentally_read_as_elevation():
    text='''$$SOE
 2026-Nov-20 12:00,*,m,89.2350,1.2451,2.550000E-03,-0.20,
 2026-Nov-20 13:00,*,m,90.2345,-0.2021,2.560000E-03,0.04,
$$EOE'''
    rows=parse_observer_csv(text,include_range=True)
    assert rows[1][2]==-0.2021
