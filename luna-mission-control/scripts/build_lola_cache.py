#!/usr/bin/env python3
"""Cache an actual NASA LOLA gridded lunar elevation mosaic for browser display.

NASA Scientific Visualization Studio CGI Moon Kit ldem_16.tif:
  16 pixels / degree, 5760x2880, float32 kilometers above 1737.4 km lunar sphere.
We resample south-of-75° elevations to 0.25° for regional viewing.
Do NOT use this for obstacle avoidance or local horizon clearance.
"""
from __future__ import annotations
import json
import math
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import tifffile

SRC = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16.tif"
DEST=Path(__file__).resolve().parents[1]/"web"/"assets"/"lola-south-025deg.json"
TMP=Path("/tmp/luna-lola-ldem16.tif")

def main():
    print(f"Downloading NASA LOLA source: {SRC}",flush=True)
    request=urllib.request.Request(SRC,headers={"User-Agent":"LUNA Space Apps planetary education tool"})
    with urllib.request.urlopen(request,timeout=180) as response, TMP.open("wb") as dst:
        while True:
            chunk=response.read(1024*1024)
            if not chunk:break
            dst.write(chunk)
    with tifffile.TiffFile(TMP) as source:
        page=source.pages[0]
        if page.shape!=(2880,5760):
            raise ValueError(f"Unexpected NASA LOLA TIFF raster shape {page.shape}")
        # North at image top: rows 2640:2880 cover -75° to -90°.
        raster=page.asarray()
    south=np.asarray(raster[2640:2880,:],dtype=np.float32)
    # Average each 4x4 sample window, avoiding gaps/invalid pixels.
    south=south.reshape(60,4,1440,4)
    good=np.isfinite(south)&(south>-15)&(south<20)
    counts=good.sum(axis=(1,3))
    total=np.where(good,south,0).sum(axis=(1,3))
    out=np.where(counts>=8,total/np.maximum(counts,1),np.nan)
    if np.isfinite(out).sum()<int(out.size*.96):
        raise ValueError("Unexpected NASA LOLA NoData coverage")
    vals=[None if not math.isfinite(float(x)) else round(float(x),3) for x in out.ravel()]
    payload={
        "schema_version":1,
        "name":"NASA LOLA lunar south polar regional elevation",
        "source":"NASA Scientific Visualization Studio CGI Moon Kit, ldem_16.tif",
        "source_url":SRC,
        "provenance":"Lunar Orbiter Laser Altimeter; 16 original pixels/degree averaged to 4 pixels/degree",
        "radius_km":1737.4,
        "unit":"km above 1737.4-km radius sphere",
        "coverage":{"latitude_min_deg":-90,"latitude_max_deg":-75,"longitude_min_deg":-180,"longitude_max_deg":180},
        "grid":{"width":1440,"height":60,"step_deg":0.25,"first_center_lat_deg":-75.125,"first_center_lon_deg":-179.875,"order":"row-major north-to-south, west-to-east"},
        "quality":"Regional raster only; approximately 7.6 km per 0.25 latitude degree. Not adequate for landing hazards, precise rover slopes, or local shadow horizons.",
        "generated_utc":datetime.now(timezone.utc).isoformat(),
        "elevations_km":vals,
    }
    DEST.parent.mkdir(parents=True,exist_ok=True)
    DEST.write_text(json.dumps(payload,separators=(",",":")),encoding="utf-8")
    print(f"Wrote NASA LOLA elevations: {len(vals)} cells, {DEST.stat().st_size} bytes",flush=True)

if __name__=="__main__":
    main()
