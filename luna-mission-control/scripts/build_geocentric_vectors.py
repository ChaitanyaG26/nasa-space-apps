#!/usr/bin/env python3
"""Cache Moon and Sun geocentric JPL Horizons ICRF position/velocity vectors.
Public astronomy reference only: it is not a spacecraft trajectory, launch
window, operational COLA clearance, or lunar descent solution.
Source: https://ssd-api.jpl.nasa.gov/doc/horizons.html
"""
from __future__ import annotations
import json
import math
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"web"/"assets"/"horizons-geocentric-icrf.json"
UTC=timezone.utc
START=datetime(2026,10,1,tzinfo=UTC)
STOP=datetime(2027,3,1,tzinfo=UTC)
CHUNK=timedelta(days=14)
STEP=timedelta(hours=1)
ENDPOINT="https://ssd.jpl.nasa.gov/api/horizons.api"
DAY_MSEC=86400000

def fetch_body(command:str)->dict[int,list[float]]:
    data={}
    begin=START
    while begin<STOP:
        end=min(begin+CHUNK,STOP)
        params={
          "format":"text","COMMAND":f"'{command}'","OBJ_DATA":"'NO'",
          "MAKE_EPHEM":"'YES'","EPHEM_TYPE":"'VECTORS'",
          "CENTER":"'500@399'","REF_PLANE":"'FRAME'","REF_SYSTEM":"'ICRF'",
          "VEC_TABLE":"'2'","CSV_FORMAT":"'YES'","OUT_UNITS":"'KM-S'",
          "START_TIME":f"'{begin:%Y-%m-%d %H:%M}'",
          "STOP_TIME":f"'{end:%Y-%m-%d %H:%M}'",
          "STEP_SIZE":"'60 min'"
        }
        response=requests.get(ENDPOINT,params=params,timeout=120)
        response.raise_for_status()
        text=response.text
        if "$$SOE" not in text or "$$EOE" not in text:
            raise RuntimeError(f"Horizons returned no ephemeris for body {command}: {text[:600]}")
        inside=text.split("$$SOE",1)[1].split("$$EOE",1)[0]
        for line in inside.splitlines():
            parts=[p.strip() for p in line.split(",")]
            if len(parts)<8:
                continue
            try:
                jd=float(parts[0])
                values=[float(x) for x in parts[2:8]]
            except ValueError:
                continue
            stamp=int(round((jd-2440587.5)*24))*3600000
            if not all(math.isfinite(x) for x in values):
                raise ValueError("Invalid JPL position/velocity vector")
            data[stamp]=values
        begin=end
        time.sleep(.35)
    return data

def main()->None:
    moon=fetch_body("301")
    sun=fetch_body("10")
    times=sorted(set(moon)&set(sun))
    expected=int((STOP-START)/STEP)+1
    assert len(times)==expected, f"Missing Horizons samples ({len(times)} != {expected})"
    for i,t in enumerate(times):
        if i and t-times[i-1]!=3600000:
            raise RuntimeError("JPL geocentric data have an hourly gap")
        rmoon=math.hypot(*moon[t][:3])
        rsun=math.hypot(*sun[t][:3])
        if not (300000<rmoon<450000 and 130_000_000<rsun<160_000_000):
            raise RuntimeError(f"Unexpected geocentric body distance at {t}")
    rows=[[stamp,*moon[stamp],*sun[stamp]] for stamp in times]
    payload={
      "schema_version":1,
      "name":"JPL Horizons geocentric ICRF vectors for Moon and Sun",
      "origin":"Earth center 500@399",
      "frame":"ICRF REF_PLANE=FRAME, geometric km and km/s",
      "step_hours":1,"start_utc":START.isoformat(),"end_utc":STOP.isoformat(),
      "generated_utc":datetime.now(UTC).isoformat(),
      "source_url":"https://ssd-api.jpl.nasa.gov/doc/horizons.html",
      "schema":"[unix_ms, moon_x,moon_y,moon_z,moon_vx,moon_vy,moon_vz,sun_x,sun_y,sun_z,sun_vx,sun_vy,sun_vz]",
      "samples":rows,
      "usage_limitation":"Ephemeris for visualization. Not flight trajectory optimization or launch collision avoidance."
    }
    OUT.parent.mkdir(exist_ok=True,parents=True)
    OUT.write_text(json.dumps(payload,separators=(",",":")),encoding="utf-8")
    print("Wrote",len(rows),"hourly JPL Earth-centered vectors to",OUT)

if __name__=="__main__":
    main()
