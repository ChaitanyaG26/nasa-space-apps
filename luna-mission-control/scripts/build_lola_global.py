#!/usr/bin/env python3
"""Create a whole-Moon 8-pixels/degree, quantized LOLA height grid.

Input: NASA GSFC SVS CGI Moon Kit ldem_16.tif (LOLA GDR); float32 km
above the 1737.4-km reference sphere. Output: little-endian int16 in
HALF-METERS relative to that same sphere, averaging each 2x2 source block.

At 8 px/degree the cell width is ~3.79 km N-S (less E-W near poles).
This is REGIONAL terrain context, not a landing-zone hazard assessment.
"""
from __future__ import annotations
import hashlib
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
import tifffile

SRC="https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16.tif"
OUT=Path(__file__).resolve().parents[1]/"web"/"assets"
RAW=OUT/"lola-global-8ppd.bin"
META=OUT/"lola-global-8ppd.json"
TMP=Path("/tmp/luna-nasa-lola-ldem16.tif")

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    request=urllib.request.Request(SRC,headers={"User-Agent":"LUNA Space Apps open-science educational website"})
    with urllib.request.urlopen(request,timeout=180) as src, TMP.open("wb") as dst:
        while chunk:=src.read(2*1024*1024):
            dst.write(chunk)
    digest=hashlib.sha256(TMP.read_bytes()).hexdigest()
    with tifffile.TiffFile(TMP) as src:
        page=src.pages[0]
        if page.shape!=(2880,5760):
            raise ValueError(f"Unexpected LOLA source shape {page.shape}")
        arr=np.asarray(page.asarray(),dtype=np.float32)
    # Preserve missing-data flags. Valid LOLA elevations at this resolution
    # should lie within a broad +/-20 km range (km above 1737.4-km sphere).
    finite=np.isfinite(arr)&(np.abs(arr)<20)
    tiled=arr.reshape(1440,2,2880,2)
    good=finite.reshape(1440,2,2880,2)
    count=good.sum(axis=(1,3))
    avg=np.where(good,tiled,0).sum(axis=(1,3))/np.maximum(count,1)
    q=np.rint(avg*2000).astype(np.int32)
    if ((q[count>=2]>=32767)|(q[count>=2]<=-32768)).any():
        raise ValueError("LOLA half-meter quantization overflow")
    out=np.where(count>=2,q,-32768).astype("<i2")
    if (count>=2).mean()<0.95:raise ValueError("LOLA source has too many missing pixels")
    RAW.write_bytes(out.tobytes(order="C"))
    if RAW.stat().st_size!=2880*1440*2:raise ValueError("Unexpected output size")
    meta={
        "schema_version":1,
        "source":"NASA LRO LOLA global GDR; NASA SVS CGI Moon Kit",
        "source_url":SRC,"source_sha256":digest,
        "file":RAW.name,"width":2880,"height":1440,"pixels_per_degree":8,
        "longitude_first_center_deg":-179.9375,
        "latitude_first_center_deg":89.9375,
        "radius_km":1737.4,
        "unit":"signed little-endian 16-bit, half-meter above 1737.4-km lunar sphere",
        "missing_value":-32768,"coverage":"Global",
        "quality":"2x2 mean of NASA LOLA 16 ppd; about 3.79 km N-S per output cell. Coarse, incomplete near-field slope/horizon; not rover or landing-safe resolution.",
        "generated_utc":datetime.now(timezone.utc).isoformat(),
    }
    META.write_text(json.dumps(meta,separators=(",",":")),encoding="utf-8")
    print("LOLA global grid cells:",out.size,"source SHA-256:",digest,flush=True)

if __name__=="__main__":main()
