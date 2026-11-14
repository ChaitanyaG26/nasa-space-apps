"""JPL Horizons lunar observer data. No guessed values on the NASA path."""
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import re
import requests

URL = 'https://ssd.jpl.nasa.gov/api/horizons.api'

class HorizonsError(RuntimeError):
    pass

def parse_observer_csv(raw: str) -> list[tuple[datetime, float, float]]:
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
        if len(nums)<2:
            raise HorizonsError('Missing azimuth/elevation in row: '+line)
        az, el = nums[-2], nums[-1]
        if not (0 <= az <= 360 and -90 <= el <= 90):
            raise HorizonsError('Out-of-range Horizons angles in row: '+line)
        parsed.append((dt,az,el))
    if len(parsed)<2:
        raise HorizonsError('Horizons table has too few valid observations')
    return parsed

@lru_cache(maxsize=128)
def _fetch(target: int, lat: float, lon: float, start_iso: str, end_iso: str, step_m: int):
    def q(s): return f"'{s}'"
    params={
        'format':'json','COMMAND':q(str(target)),'MAKE_EPHEM':q('YES'),
        'OBJ_DATA':q('NO'),'EPHEM_TYPE':q('OBSERVER'),
        'CENTER':q('coord@301'),'COORD_TYPE':q('GEODETIC'),
        'SITE_COORD':q(f'{lon % 360:.6f},{lat:.6f},0'),
        'START_TIME':q(start_iso),'STOP_TIME':q(end_iso),
        'STEP_SIZE':q(f'{step_m}m'),'QUANTITIES':q('4'),
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
    return parse_observer_csv(data.get('result',''))

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
