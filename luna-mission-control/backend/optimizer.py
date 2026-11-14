"""Constraint-preserving exploration, deliberately not a landing safety certification."""
from datetime import timedelta
from .models import MissionRequest
from .science import run_mission
from .horizons import HorizonsError

GRID=[(-89.5,0),(-89.5,45),(-89.5,90),(-89.5,135),(-89.5,-90),
      (-89.1,15),(-89.1,75),(-89.1,145),(-88.5,-35),(-88.5,55),(-88.5,135)]

def _rank(result:dict, req:MissionRequest):
    m=result['metrics']
    possible=1361*req.area_m2*0.24*0.8*req.duration_days*24
    energy_quality=min(1.0,m['total_energy_wh']/max(1.0,possible))
    comms_quality=m['earth_fraction']
    return (int(m['feasible']),round(0.6*energy_quality+0.4*comms_quality,6),m['min_soc'])

def optimize(req:MissionRequest,preserve:str):
    baseline=run_mission(req)
    options=[]
    if preserve=='time':
        cases=[('Grid '+str(i+1),lat,lon) for i,(lat,lon) in enumerate(GRID)]
        if not any(abs(lat-req.latitude)<0.0001 and abs(lon-req.longitude)<0.0001 for _,lat,lon in cases):
            cases.append(('Selected site',req.latitude,req.longitude))
        for name,lat,lon in cases:
            q=req.model_copy(update={'latitude':lat,'longitude':lon})
            result=run_mission(q)
            options.append((name,result))
        search='Demonstration grid of 11 south-pole coordinates; not vetted landing zones.'
    elif preserve=='site':
        for half_day in range(-28,29):
            dt=req.landing_time+timedelta(hours=half_day*12)
            q=req.model_copy(update={'landing_time':dt})
            result=run_mission(q)
            options.append((f'{half_day*12:+d} h',result))
        search='Fixed site; landing dates sampled every 12 hours within ±14 days.'
    else:
        raise ValueError('preserve must be site or time')
    ranked=sorted(options,key=lambda pair:_rank(pair[1],req),reverse=True)
    if preserve=='site':
        ranked=[x for x in ranked if x[1]['landing_time']!=baseline['landing_time']]
    else:
        ranked=[x for x in ranked if (x[1]['site']['latitude'],x[1]['site']['longitude'])!=(req.latitude,req.longitude)]
    best=ranked[0] if ranked else None
    return dict(original=baseline, recommended=best[1] if best else None,
                recommendation_name=best[0] if best else None,
                alternatives=[dict(name=name,site=r['site'],landing_time=r['landing_time'],metrics=r['metrics']) for name,r in ranked[:5]],
                preserve=preserve,search=search,
                comparison_note=('No evaluated option passes both battery-reserve and 24-hour-blackout checks.' if not any(x[1]['metrics']['feasible'] for x in ranked) else 'Top feasible option is ranked by modeled energy and Earth visibility.'),
                scientific_limit='Offline mode is illustrative and assumes a flat horizon; candidate coordinates are not certified landing sites.')
