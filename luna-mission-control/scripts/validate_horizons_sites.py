#!/usr/bin/env python3
"""Compare LUNA site-projected Horizons geometry against DIRECT JPL Horizons.

Independent verification, not self-comparison. Output residuals rather than
silently claiming exact validation. Uses the committed one-hour reference
ephemeris and direct NASA Horizons QUANTITIES=4 at three lunar sites.
"""
from __future__ import annotations
import json
import math
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
APP=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(APP))
from backend.horizons import get_series_with_ranges

SOURCE=APP/"web"/"assets"/"horizons-moon-reference.json"
TARGET=APP/"web"/"assets"/"horizons-direct-check.json"
R=1737.4
RAD=math.pi/180
SITES=[(-89.5,0.0),(-85.0,90.0),(-53.033,-99.811)]
START=datetime(2026,12,12,12,tzinfo=timezone.utc)
END=START+timedelta(hours=24)

def infer_at(data,lat,lon,stamp):
    rows=data["samples"]
    when=int(stamp.timestamp()*1000)
    step=int(data["step_hours"]*3600000)
    i=(when-rows[0][0])//step
    if not (0<=i<len(rows)-1):
        raise ValueError("NASA reference cache does not cover validation epoch")
    a,b=rows[i],rows[i+1]
    t=(when-a[0])/(b[0]-a[0])
    p=lat*RAD;l=lon*RAD
    radial=(math.cos(p)*math.sin(l),math.sin(p),math.cos(p)*math.cos(l))
    east=(math.cos(l),0,-math.sin(l))
    north=(-math.sin(p)*math.sin(l),math.cos(p),-math.sin(p)*math.cos(l))
    result={}
    for body,index in (("sun",1),("earth",4)):
        vec=[a[k]+t*(b[k]-a[k])-R*radial[k-index] for k in range(index,index+3)]
        mag=math.sqrt(sum(x*x for x in vec))
        vec=[x/mag for x in vec]
        dot=lambda u:sum(x*y for x,y in zip(vec,u))
        az=(math.degrees(math.atan2(dot(east),dot(north)))+360)%360
        el=math.degrees(math.asin(max(-1,min(1,dot(radial)))))
        result[body]=(az,el)
    return result

def angular_error(actual,predicted):
    a,e=actual;p,q=predicted
    vec=lambda az,el:(math.cos(el*RAD)*math.sin(az*RAD),
                      math.cos(el*RAD)*math.cos(az*RAD),math.sin(el*RAD))
    x=vec(a,e);y=vec(p,q)
    dot=max(-1,min(1,sum(i*j for i,j in zip(x,y))))
    return math.degrees(math.acos(dot))

def main():
    data=json.loads(SOURCE.read_text(encoding="utf-8"))
    if data["schema_version"]!=2:
        raise ValueError("Expected NASA Horizons v2 center-position cache")
    comparisons=[]
    for lat,lon in SITES:
        direct=get_series_with_ranges(lat,lon,START,END,180)
        for observation in direct:
            computed=infer_at(data,lat,lon,observation["time"])
            for body in ("sun","earth"):
                actual=(observation[body+"_az"],observation[body+"_el"])
                err=angular_error(actual,computed[body])
                comparisons.append(dict(latitude=lat,longitude=lon,
                    time_utc=observation["time"].isoformat(),
                    body=body,angular_error_deg=round(err,5),
                    direct_az_deg=actual[0],direct_el_deg=actual[1],
                    projected_az_deg=round(computed[body][0],4),
                    projected_el_deg=round(computed[body][1],4)))
    if len(comparisons)<24:
        raise ValueError("Insufficient direct Horizons observations for comparison")
    maxima={body:max(x["angular_error_deg"] for x in comparisons if x["body"]==body) for body in ("sun","earth")}
    report={
      "schema_version":1,
      "description":"Independent direct JPL Horizons lunar-site observer comparison; not validation of terrain shadows or spacecraft systems",
      "reference_source":"NASA Horizons cached 0N 0E observer azimuth/elevation/range",
      "truth_source":"Direct NASA Horizons QUANTITIES=4,20 site observer queries",
      "time_window_utc":[START.isoformat(),END.isoformat()],
      "sites":[{"latitude":a,"longitude":b} for a,b in SITES],
      "sample_count":len(comparisons),
      "max_error_deg":maxima,
      "mean_error_deg":{body:round(sum(x["angular_error_deg"] for x in comparisons if x["body"]==body)/(len(comparisons)/2),5) for body in ("sun","earth")},
      "validation_status":"SITE-CHECKED within 1 degree" if max(maxima.values())<1 else "CHECKED WITH MEASURED RESIDUALS — NOT 1-DEGREE VALIDATED",
      "samples":comparisons
    }
    TARGET.write_text(json.dumps(report,separators=(",",":")),encoding="utf-8")
    print("Horizons independent site-check:",report["validation_status"],report["max_error_deg"],flush=True)
    # Fail only if coordinates/frames are seriously inconsistent. Errors
    # above 1 degree are always disclosed in the published quality report.
    if max(maxima.values())>10:
        raise ValueError("Direct site Horizons discrepancy exceeds 10 degrees; check frame and time conventions")

if __name__=="__main__":
    main()
