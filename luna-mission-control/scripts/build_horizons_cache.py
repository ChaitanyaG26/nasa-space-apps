#!/usr/bin/env python3
"""Produce a compact, verifiable lunar reference ephemeris from NASA JPL Horizons.

The browser cannot embed NASA SSD API calls (CORS terms); this generator runs
server-side in GitHub Actions and publishes Horizons-derived reference directions.
Moon-fixed Cartesian axes: X at 90E equator, Y north, Z at 0E equator.
A 0,0 lunar observer is used as the shared reference. Projecting its directions
to other sites is an approximation and not a new site-specific Horizons query.
"""
from __future__ import annotations
import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP))
from backend.horizons import get_series

UTC = timezone.utc
START = datetime(2026, 10, 1, tzinfo=UTC)
END = datetime(2027, 3, 1, tzinfo=UTC)
STEP_MINUTES = 180
CHUNK_DAYS = 24
OUTPUT = APP / "web" / "assets" / "horizons-moon-reference.json"


def direction(az: float, elevation: float) -> list[float]:
    a, e = map(math.radians, (az, elevation))
    # At latitude 0 / longitude 0: east=+X, north=+Y, zenith=+Z.
    return [
        round(math.cos(e) * math.sin(a), 9),
        round(math.cos(e) * math.cos(a), 9),
        round(math.sin(e), 9),
    ]


def main():
    samples = []
    cursor = START
    while cursor < END:
        chunk_end = min(cursor + timedelta(days=CHUNK_DAYS), END)
        print(f"Downloading JPL Horizons: {cursor.isoformat()} to {chunk_end.isoformat()}", flush=True)
        # Each call gets Sun and Earth reference-site observables from Horizons.
        chunk = get_series(0.0, 0.0, cursor, chunk_end, STEP_MINUTES)
        for row in chunk:
            instant = row["time"].astimezone(UTC)
            if instant < START or instant > END:
                continue
            time_ms = int(instant.timestamp() * 1000)
            if samples and time_ms <= samples[-1][0]:
                if time_ms == samples[-1][0]:
                    continue  # Horizons includes the boundary in adjacent chunks
                raise ValueError("JPL Horizons timestamps out of order")
            samples.append([
                time_ms,
                *direction(row["sun_az"], row["sun_el"]),
                *direction(row["earth_az"], row["earth_el"]),
            ])
        cursor = chunk_end

    expected = int((END-START).total_seconds() / (STEP_MINUTES*60)) + 1
    if len(samples) != expected:
        raise ValueError(f"Expected {expected} Horizons samples; obtained {len(samples)}")
    step_ms = STEP_MINUTES*60*1000
    for i, row in enumerate(samples):
        if i and row[0] - samples[i-1][0] != step_ms:
            raise ValueError(f"Missing or irregular sample at row {i}")
        for offset in (1, 4):
            length=math.sqrt(sum(row[j]**2 for j in range(offset,offset+3)))
            if abs(length-1)>1e-6:
                raise ValueError(f"Invalid Horizons direction at sample {i}")

    payload = {
        "schema_version": 1,
        "name": "JPL Horizons lunar reference ephemeris",
        "source": "NASA JPL Horizons observer output, QUANTITIES=4",
        "documentation_url": "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
        "reference": {
            "center": "coord@301",
            "latitude_deg": 0,
            "longitude_deg_east": 0,
            "height_km": 0,
            "note": "Projected to other lunar sites from this fixed observer; not direct site-specific Horizons output.",
        },
        "frame": "Moon-fixed vectors (+X=90E equator, +Y=north, +Z=0E equator)",
        "interpolation": "normalized linear direction interpolation",
        "start_utc": START.isoformat().replace("+00:00","Z"),
        "end_utc": END.isoformat().replace("+00:00","Z"),
        "step_hours": STEP_MINUTES//60,
        "generated_utc": datetime.now(UTC).isoformat().replace("+00:00","Z"),
        "samples": samples
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload,separators=(",",":")),encoding="utf-8")
    print(f"Saved {len(samples)} NASA/JPL rows to {OUTPUT} ({OUTPUT.stat().st_size} bytes)",flush=True)


if __name__ == "__main__":
    main()
