"""JPL Horizons lunar observer data. No guessed values on the NASA path."""
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import re
import requests

URL = 'https://ssd.jpl.nasa.gov/api/horizons.api'

AU_KM = 149597870.700  # IAU 2012 definition

class HorizonsError(RuntimeError):
    pass

def parse_observer_csv(raw: str, include_range: bool=False) -> list[tuple]:
    """Read QUANTITIES=4 CSV table. Returns UTC time, azimuth, elevation.

    Horizons may emit illumination marker fields between timestamp and angles.
    We request quantity 4 only, so the *last two numerical fields* are
    azimuth/elevation. Do not assume visibility flags are present.
    """
    if '$$SOE' not in raw or '$$EOE' not in raw:
        raise HorizonsError('Horizons did not return an observer table: '+raw[:200])
    body = raw.split('$$SOE',1)[1].split('$$EOE',1)[0]
    parsed = []
    for line in body.strip().splitlines():
        fields = [x.strip() for x in line.split(',')]
        if not fields or not fields[0]:
            continue
        stamp = re.sub(r'^A\.D\.\s*', '', fields[0])
        stamp = stamp.replace(' ', ' ', 1)
        dt = None
        for fmt in ('%Y-%b-%d %H:%M:%S.%f','%Y-%b-%d %H:%M:%S','%Y-%b-%d %H:%M','%Y-%b-%d %H'):
            try:
                dt=datetime.strptime(stamp,fmt).replace(tzinfo=timezone.utc)
                break
            except ValueError:
                pass
        if dt is None:
            raise HorizonsError('Unrecognized Horizons UTC timestamp: '+repr(stamp))
        nums=[]
        for field in fields[1:]:
            if re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?',field):
                nums.append(float(field))
        if len(nums)<(4 if include_range else 2):
            raise HorizonsError('Missing azimuth/elevation or range in row: '+line)
        az, el = (nums[-4], nums[-3]) if include_range else nums[-2:]
        if not (0 <= az <= 360 and -90 <= el <= 90):
            raise HorizonsError('Out-of-range Horizons angles in row: '+line)
        if include_range:
            distance_km=nums[-2]*AU_KM
            if not (1e5 < distance_km < 2e8):
                raise HorizonsError('Unexpected Horizons range in km: '+str(distance_km))
            parsed.append((dt,az,el,distance_km))
        else:
            parsed.append((dt,az,el))
    if len(parsed)<2:
        raise HorizonsError('Horizons table has too few valid observations')
    return parsed

@lru_cache(maxsize=128)
def _fetch(target: int, lat: float, lon: float, start_iso: str, end_iso: str, step_m: int, quantity: str='4'):
    def q(s): return f"'{s}'"
    params={
        'format':'json','COMMAND':q(str(target)),'MAKE_EPHEM':q('YES'),
        'OBJ_DATA':q('NO'),'EPHEM_TYPE':q('OBSERVER'),
        'CENTER':q('coord@301'),'COORD_TYPE':q('GEODETIC'),
        'SITE_COORD':q(f'{lon % 360:.6f},{lat:.6f},0'),
        'START_TIME':q(start_iso),'STOP_TIME':q(end_iso),
        'STEP_SIZE':q(f'{step_m}m'),'QUANTITIES':q(quantity),
        'CSV_FORMAT':q('YES'),'ANG_FORMAT':q('DEG'),
        'CAL_FORMAT':q('CAL'),'APPARENT':q('AIRLESS'),
        'TIME_TYPE':q('UT'),'TIME_ZONE':q('+00:00'),
    }
    try:
        response=requests.get(URL,params=params,timeout=25)
        response.raise_for_status()
        data=response.json()
    except (requests.RequestException,ValueError) as e:
        raise HorizonsError(f'JPL Horizons request failed: {e}') from e
    if 'error' in data:
        raise HorizonsError(str(data['error']))
    return parse_observer_csv(data.get('result',''),include_range=(quantity=='4,20'))

def get_series(lat: float, lon: float, start: datetime, end: datetime, step_minutes: int=60):
    if end<=start:
        raise ValueError('end must follow start')
    if (end-start).days>45:
        raise ValueError('Horizon query must be <=45 days')
    a=start.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M')
    b=end.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M')
    sun=_fetch(10,round(lat,4),round(lon,4),a,b,step_minutes)
    earth=_fetch(399,round(lat,4),round(lon,4),a,b,step_minutes)
    if len(sun)!=len(earth) or any(s[0]!=e[0] for s,e in zip(sun,earth)):
        raise HorizonsError('Sun/Earth observer timestamps do not align')
    return [dict(time=s[0],sun_az=s[1],sun_el=s[2],earth_az=e[1],earth_el=e[2]) for s,e in zip(sun,earth)]

def get_series_with_ranges(lat:float,lon:float,start:datetime,end:datetime,step_minutes:int=60):
    """Observer az/el and target distance from NASA Horizons quantities 4,20.

    The distance to each body is its apparent topocentric range in kilometers.
    This supports reconstructing body positions relative to the lunar center,
    then subtracting other Moon-surface observers' positions (parallax).
    """
    if end<=start or end-start>timedelta(days=45):
        raise ValueError('Invalid Horizons query window (must be within 45 days)')
    a=start.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M')
    b=end.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M')
    sun=_fetch(10,round(lat,4),round(lon,4),a,b,step_minutes,'4,20')
    earth=_fetch(399,round(lat,4),round(lon,4),a,b,step_minutes,'4,20')
    if len(sun)!=len(earth) or any(s[0]!=e[0] for s,e in zip(sun,earth)):
        raise HorizonsError('Sun/Earth az-el/range samples do not align')
    for s,e in zip(sun,earth):
        if not 1.3e8<s[3]<1.7e8:
            raise HorizonsError('Sun observer range is implausible: '+str(s[3]))
        if not 3e5<e[3]<5e5:
            raise HorizonsError('Earth observer range is implausible: '+str(e[3]))
    return [dict(time=s[0],sun_az=s[1],sun_el=s[2],sun_range_km=s[3],
                 earth_az=e[1],earth_el=e[2],earth_range_km=e[3])
            for s,e in zip(sun,earth)]
