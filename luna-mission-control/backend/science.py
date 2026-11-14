"""Transparent offline demonstration model and preliminary power integration.

Offline astronomy is schematic, NOT verified NASA ephemerides. Terrain horizon
is assumed flat and no rover/seismic risk is inferred.
"""
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from math import sin, cos, atan2, asin, acos, sqrt, radians, degrees, pi
from .models import MissionRequest
from .horizons import get_series

EPOCH = datetime(2026,11,20,tzinfo=timezone.utc)
LUNAR_SOLAR_DAY=29.53059
SUN_RADIUS_DEG=0.266

def clamp(x,lo,hi): return max(lo,min(hi,x))

def _body_azel(lat:float,lon:float,sub_lat:float,sub_lon:float):
    phi,dec,dl=map(radians,(lat,sub_lat,sub_lon-lon))
    elev=asin(clamp(sin(phi)*sin(dec)+cos(phi)*cos(dec)*cos(dl),-1,1))
    az=atan2(sin(dl)*cos(dec),cos(phi)*sin(dec)-sin(phi)*cos(dec)*cos(dl))
    return (degrees(az)%360,degrees(elev))

def demo_geometry(lat: float,lon: float,t:datetime):
    days=(t-EPOCH).total_seconds()/86400
    subsolar_lon=(12.19*days)%360
    sun_dec=1.54*sin(2*pi*days/(365.25))
    subearth_lon=6.5*sin(2*pi*days/27.32)
    subearth_lat=5.8*sin(2*pi*days/27.2-0.7)
    sun_az,sun_el=_body_azel(lat,lon,sun_dec,subsolar_lon)
    earth_az,earth_el=_body_azel(lat,lon,subearth_lat,subearth_lon)
    return dict(time=t,sun_az=sun_az,sun_el=sun_el,earth_az=earth_az,earth_el=earth_el)

def visible_disk(clearance:float,radius:float=SUN_RADIUS_DEG):
    x=clearance/radius
    if x<=-1:return 0.0
    if x>=1:return 1.0
    return (acos(-x)+x*sqrt(max(0,1-x*x)))/pi

def solar_watts(sun_az,sun_el,area,tilt,facing,sun_fraction):
    e,b,d=map(radians,(sun_el,tilt,sun_az-facing))
    incidence=sin(e)*cos(b)+cos(e)*sin(b)*cos(d)
    return max(0,incidence)*1361*area*0.24*0.80*sun_fraction

def _intervals(rows,key):
    """Sampled boolean intervals, with [start,end) hourly step conventions."""
    windows=[]
    if len(rows)<2:return windows
    step=(rows[1]['datetime']-rows[0]['datetime']).total_seconds()/3600
    opening=None
    for row in rows:
        if row[key] and opening is None:opening=row['datetime']
        if not row[key] and opening is not None:
            windows.append(dict(start=opening.isoformat(),end=row['datetime'].isoformat(),hours=(row['datetime']-opening).total_seconds()/3600))
            opening=None
    if opening is not None:
        last=rows[-1]['datetime']
        windows.append(dict(start=opening.isoformat(),end=last.isoformat(),hours=(last-opening).total_seconds()/3600))
    return windows

def _max_false_gap(rows,key):
    if len(rows)<2:return 0
    best=run=0.0
    for i in range(len(rows)-1):
        delta=(rows[i+1]['datetime']-rows[i]['datetime']).total_seconds()/3600
        if not rows[i][key]:run+=delta
        else:run=0
        best=max(best,run)
    return round(best,2)

def run_mission(req:MissionRequest, preloaded=None):
    start=req.landing_time
    end=start+timedelta(days=req.duration_days)
    if preloaded is not None:
        geometry=preloaded
    elif req.data_mode=='horizons':
        geometry=get_series(req.latitude,req.longitude,start,end,60)
    else:
        geometry=[demo_geometry(req.latitude,req.longitude,start+timedelta(hours=i)) for i in range(req.duration_days*24+1)]
    if len(geometry)<2:raise ValueError('Insufficient ephemeris samples')
    energy=req.battery_wh*0.9
    temp=-75.0
    rows=[]
    reserve_crossing=None
    for i,g in enumerate(geometry):
        fraction=visible_disk(g['sun_el'])
        power=solar_watts(g['sun_az'],g['sun_el'],req.area_m2,req.panel_tilt_deg,req.panel_az_deg,fraction)
        rows.append(dict(datetime=g['time'],time=g['time'].isoformat(),hours=(g['time']-start).total_seconds()/3600,
                         sun_az=round(g['sun_az'],2),sun_el=round(g['sun_el'],2),
                         earth_az=round(g['earth_az'],2),earth_el=round(g['earth_el'],2),
                         power_w=round(power,2),sun_visible=fraction>0,earth_visible=g['earth_el']>0,
                         solar_fraction=round(fraction,3),battery_wh=round(energy,2),soc=round(100*energy/req.battery_wh,2),
                         temperature_proxy_c=round(temp,2)))
        if reserve_crossing is None and energy<req.battery_wh*req.reserve_percent/100:
            reserve_crossing=g['time'].isoformat()
        if i+1>=len(geometry):continue
        delta=(geometry[i+1]['time']-g['time']).total_seconds()/3600
        if not (0<delta<=24):raise ValueError('Invalid ephemeris time step')
        nxt=geometry[i+1]
        nextpower=solar_watts(nxt['sun_az'],nxt['sun_el'],req.area_m2,req.panel_tilt_deg,req.panel_az_deg,visible_disk(nxt['sun_el']))
        net=(power+nextpower)/2-req.load_w
        energy=clamp(energy+(net*0.95 if net>=0 else net/0.9)*delta,0,req.battery_wh)
        target=-145+210*clamp(fraction*max(0,sin(radians(max(0,g['sun_el']))))*5,0,1)
        temp+=(target-temp)*(1-__import__('math').exp(-delta/12))
    socs=[x['soc'] for x in rows]
    max_gap=_max_false_gap(rows,'earth_visible')
    sun_hours=sum((rows[i+1]['hours']-rows[i]['hours']) * float(rows[i]['sun_visible']) for i in range(len(rows)-1))
    earth_hours=sum((rows[i+1]['hours']-rows[i]['hours']) * float(rows[i]['earth_visible']) for i in range(len(rows)-1))
    energy_wh=sum((rows[i+1]['hours']-rows[i]['hours'])*(rows[i]['power_w']+rows[i+1]['power_w'])/2 for i in range(len(rows)-1))
    hours=req.duration_days*24
    reserve_ok=min(socs)>=req.reserve_percent
    comms_ok=max_gap<=24
    result=dict(
        site=dict(latitude=req.latitude,longitude=req.longitude),
        landing_time=start.isoformat(),duration_days=req.duration_days,
        quality=dict(ephemeris=('JPL Horizons observer az/el' if req.data_mode=='horizons' else 'OFFLINE ILLUSTRATIVE GEOMETRY'),
                     terrain='FLAT HORIZON ASSUMPTION — NOT LOLA-VALIDATED',
                     temperature='UNVALIDATED SURFACE-RESPONSE PROXY — NOT SPACECRAFT TEMPERATURE',
                     seismic='NO SITE-SPECIFIC SEISMIC ASSESSMENT',
                     rover='NO ROVER TRAVERSABILITY DETERMINED'),
        metrics=dict(total_energy_wh=round(energy_wh),sun_hours=round(sun_hours,1),earth_hours=round(earth_hours,1),
                     earth_fraction=round(earth_hours/hours,3),max_earth_blackout_h=max_gap,
                     max_darkness_h=_max_false_gap(rows,'sun_visible'),
                     min_soc=round(min(socs),1),battery_reserve_pass=reserve_ok,
                     communication_pass=comms_ok,feasible=reserve_ok and comms_ok,
                     first_reserve_violation=reserve_crossing),
        earth_windows=_intervals(rows,'earth_visible'),sun_windows=_intervals(rows,'sun_visible'),
        samples=[{k:v for k,v in row.items() if k!='datetime'} for row in rows]
    )
    return result

def preview(req:MissionRequest):
    if req.data_mode=='horizons':
        anchor=req.landing_time.replace(minute=0,second=0,microsecond=0)
        rows=get_series(req.latitude,req.longitude,anchor,anchor+timedelta(hours=2),60)
        row=min(rows,key=lambda r:abs((r['time']-req.landing_time).total_seconds()))
        source='JPL Horizons — nearest hourly sample'
    else:
        row=demo_geometry(req.latitude,req.longitude,req.landing_time)
        source='OFFLINE ILLUSTRATIVE — NOT NASA EPHEMERIS'
    return dict(source=source,sun_az=round(row['sun_az'],2),sun_el=round(row['sun_el'],2),
                earth_az=round(row['earth_az'],2),earth_el=round(row['earth_el'],2))
