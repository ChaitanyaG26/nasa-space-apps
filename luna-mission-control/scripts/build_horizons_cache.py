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
from backend.horizons import get_series_with_ranges

UTC = timezone.utc
START = datetime(2026, 10, 1, tzinfo=UTC)
END = datetime(2027, 3, 1, tzinfo=UTC)
STEP_MINUTES = 180
CHUNK_DAYS = 24
OUTPUT = APP / "web" / "assets" / "horizons-moon-reference.json"
MOON_REFERENCE_RADIUS_KM = 1737.4


def center_position(az:float,elevation:float,observer_range_km:float)->list[float]:
    """Topocentric az/el and range -> Moon-center-relative body xyz (km).

    At lunar 0°N,0°E: east=+X, north=+Y, up=+Z.
    The observer is at (0,0,1737.4 km) on the Horizons reference sphere.
    """
    a,e=map(math.radians,(az,elevation))
    return [
        round(observer_range_km*math.cos(e)*math.sin(a),5),
        round(observer_range_km*math.cos(e)*math.cos(a),5),
        round(MOON_REFERENCE_RADIUS_KM+observer_range_km*math.sin(e),5),
    ]


def main():
    samples = []
    cursor = START
    while cursor < END:
        chunk_end = min(cursor + timedelta(days=CHUNK_DAYS), END)
        print(f"Downloading JPL Horizons: {cursor.isoformat()} to {chunk_end.isoformat()}", flush=True)
        # Each call gets Sun and Earth reference-site observables from Horizons.
        chunk = get_series_with_ranges(0.0, 0.0, cursor, chunk_end, STEP_MINUTES)
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
                *center_position(row["sun_az"], row["sun_el"], row["sun_range_km"]),
                *center_position(row["earth_az"], row["earth_el"], row["earth_range_km"]),
            ])
        cursor = chunk_end

    expected = int((END-START).total_seconds() / (STEP_MINUTES*60)) + 1
    if len(samples) != expected:
        raise ValueError(f"Expected {expected} Horizons samples; obtained {len(samples)}")
    step_ms = STEP_MINUTES*60*1000
    for i, row in enumerate(samples):
        if i and row[0] - samples[i-1][0] != step_ms:
            raise ValueError(f"Missing or irregular sample at row {i}")
        sun_distance=math.hypot(*row[1:4])
        earth_distance=math.hypot(*row[4:7])
        if not (1.3e8<sun_distance<1.7e8 and 3e5<earth_distance<5e5):
            raise ValueError(f"Implausible Sun/Earth center distances at sample {i}")

    payload = {
        "schema_version": 2,
        "name": "JPL Horizons lunar reference ephemeris",
        "source": "NASA JPL Horizons observer output, QUANTITIES=4,20",
        "documentation_url": "https://ssd-api.jpl.nasa.gov/doc/horizons.html",
        "reference": {
            "center": "coord@301",
            "latitude_deg": 0,
            "longitude_deg_east": 0,
            "height_km": 0,
            "radius_km": MOON_REFERENCE_RADIUS_KM,
            "note": "Center-relative body positions reconstructed from reference observer's apparent azimuth, elevation, and distance. Any selected surface site is shifted by its position vector to calculate parallax; approximation remains due to reference frame, local relief, and apparent light-time.",
        },
        "frame": "Moon-fixed center-relative position km (+X=90E equator, +Y=north, +Z=0E equator)",
        "interpolation": "linear Cartesian position interpolation (3h step)",
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
