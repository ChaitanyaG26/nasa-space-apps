#!/usr/bin/env python3
"""PDS Diviner bolometric brightness temperatures, binned by lat/lon/local time.

NASA LRO Diviner GCP (2009-07-05 to 2015-04-01), 2 pixels per degree,
15-minute local-time intervals. Source format: PDS DLRE_GCP.FMT:
clon bytes 1-7; clat 10-15; ltim 18-23; TBOL 103-111 (1-indexed).
We publish compact, lossless-to-0.1K int16 climatological samples.

This is HISTORICAL regolith brightness temperature, not a spacecraft
temperature or a direct observation made on the selected 2026 date.
"""
from __future__ import annotations
import hashlib
import json
import math
import struct
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gcp/"
DEST = Path(__file__).resolve().parents[1] / "web" / "assets"
BANDS = ("60s50s", "90s80s")
WIDTH, HEIGHT, TIMES = 720, 20, 96
NODATA = -32768
SOURCE_FMT = "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/label/dlre_gcp.fmt"

def parse_record(record: bytes):
    """Decode the official fixed-byte PDS3 table, not CSV assumptions."""
    if len(record) < 111:
        raise ValueError(f"Diviner record too short: {len(record)}")
    return (float(record[0:7]), float(record[9:15]),
            float(record[17:23]), float(record[102:111]))

def process_band(band: str):
    north = -int(band[3:5])
    uri = URL + f"global_cumul_avg_cyl_{band}_002.tab"
    source = hashlib.sha256()
    output = [NODATA] * (WIDTH * HEIGHT * TIMES)
    valid = 0
    lines = 0
    print("Downloading NASA Diviner GCP", uri, flush=True)
    req = urllib.request.Request(uri, headers={"User-Agent":"LUNA Space Apps NASA open-science educational tool"})
    with urllib.request.urlopen(req,timeout=180) as response:
        # First record is the header, followed by 1,382,400 fixed-width rows.
        header = response.readline()
        source.update(header)
        if not all(field in header.lower() for field in (b"clon", b"clat", b"ltim", b"tbol")):
            raise ValueError(f"Unexpected Diviner PDS table header for {band}: {header[:110]!r}")
        for line in response:
            source.update(line)
            lines += 1
            lon, lat, local_time, tbol = parse_record(line)
            x = round((lon + 179.75) * 2)
            y = round((north - 0.25 - lat) * 2)
            slot = round((local_time - 0.125) * 4)
            if not (0 <= x < WIDTH and 0 <= y < HEIGHT and 0 <= slot < TIMES):
                raise ValueError(f"Diviner bin index outside {band} grid: {(lon,lat,local_time)} -> {(x,y,slot)}")
            if tbol in (-9999.,-9998.) or not math.isfinite(tbol):
                continue
            # Diviner measured permanently shadowed polar cold traps colder
            # than 30 K; the previous >=30 K filter incorrectly discarded
            # genuine NASA measurements. Keep physical positive temperatures.
            if tbol <= 0:
                continue  # non-physical/negative radiance retrieval, not TBOL
            if tbol > 500:
                raise ValueError(f"Implausible Diviner bolometric temperature: {tbol} K")
            q = round(tbol * 10)
            idx = (y * WIDTH + x) * TIMES + slot
            if output[idx] != NODATA:
                raise ValueError("Duplicate PDS Diviner bin: " + str((x,y,slot)))
            output[idx] = q
            valid += 1
    if lines != 1382400:
        raise ValueError(f"Expected 1,382,400 PDS rows for {band}, received {lines}")
    if valid < 30000:
        raise ValueError(f"Too few valid Diviner measurements ({valid}) in band {band}")
    binary = DEST / f"diviner-gcp-{band}.bin"
    with binary.open("wb") as stream:
        for offset in range(0, len(output), 100000):
            sub = output[offset:offset+100000]
            stream.write(struct.pack("<" + "h"*len(sub),*sub))
    if binary.stat().st_size != WIDTH*HEIGHT*TIMES*2:
        raise ValueError("Unexpected Diviner data size")
    return {
        "name": band, "latitude_north_edge": north,
        "file": binary.name,"valid_samples":valid,
        "source_url":uri,"source_sha256":source.hexdigest()
    }

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    bands=[process_band(band) for band in BANDS]
    meta={
        "schema_version":1,"name":"NASA LRO Diviner measured bolometric brightness temperature climatology",
        "instrument":"NASA LRO Diviner Lunar Radiometer Experiment",
        "source_product":"PDS3 LRO-L-DLRE-5-GCP-V1.0, Global Cumulative Product",
        "format_url":SOURCE_FMT,
        "reference":"Williams et al. (2017), Icarus 283, 300-325, doi:10.1016/j.icarus.2016.08.012",
        "observation_period":"2009-07-05 through 2015-04-01",
        "description":"Measured historical binned regolith brightness temperature, not 2026 observed temperature, not a spacecraft temperature.",
        "width":WIDTH,"height_per_band":HEIGHT,"local_time_bins":TIMES,
        "spatial_resolution_deg":0.5,"local_time_resolution_h":0.25,
        "temperature_units":"int16 tenths kelvin","missing_value":NODATA,
        "longitude_first_center_deg":-179.75,
        "coverage":"Only 50-60°S and 80-90°S bands; other sites retain a clearly marked physical projection.",
        "bands":bands,"generated_utc":datetime.now(timezone.utc).isoformat()
    }
    (DEST/"diviner-gcp-meta.json").write_text(json.dumps(meta,separators=(",",":")),encoding="utf-8")
    print("NASA Diviner sample bins:", [b["valid_samples"] for b in bands], flush=True)

if __name__=="__main__":
    main()
