#!/usr/bin/env python3
"""Extract small true 20-m LOLA elevation patches from NASA PGDA COG.

Uses windowed reads/reprojection of the official 2.6GB Cloud Optimized
GeoTIFF, never downloads the entire source. NASA product is in meters
on the MOON_ME south-polar stereographic projection (DE421 frame).
Output: localized 10.24km x 10.24km moon-spherical azimuthal-equidistant
patches, 20m per cell (signed int16 meters relative to lunar sphere).

Geodetic registration is checked through GDAL/PROJ; if unsupported,
the workflow FAILS rather than silently inventing terrain.
"""
from __future__ import annotations
import json
import math
from datetime import datetime,timezone
from pathlib import Path
import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import Affine
from rasterio.warp import reproject
SRC="https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF"
OUTPUT=Path(__file__).resolve().parents[1]/"web"/"assets"
R=1737400
SIZE=512
CELL=20
CENTERS=[("south-pole-sector-0",-89.5,0.0),
         ("south-pole-sector-90",-89.5,90.0),
         ("south-pole-sector-180",-89.5,180.0),
         ("south-polar-sector-45",-85.0,45.0)]
def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    products=[]
    # Windowed COG fetches use HTTP byte ranges.
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="YES",
                      GDAL_HTTP_MAX_RETRY="4",GDAL_HTTP_RETRY_DELAY="2",
                      GDAL_HTTP_TIMEOUT="90",
                      CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".TIF"):
        with rasterio.open("/vsicurl/"+SRC) as src:
            if src.crs is None:
                raise ValueError("NASA source GeoTIFF lacks projection metadata")
            if abs(abs(src.res[0])-CELL)>1 or abs(abs(src.res[1])-CELL)>1:
                raise ValueError(f"Unexpected NASA COG pixel size: {src.res}")
            for name,lat,lon in CENTERS:
                # Local azimuthal-equidistant grid: East (+X), North (+Y).
                dest_crs=CRS.from_string(
                    f"+proj=aeqd +lat_0={lat} +lon_0={lon} +R={R} +units=m +no_defs")
                transform=Affine(CELL,0,-SIZE*CELL/2,0,-CELL,SIZE*CELL/2)
                elevation=np.full((SIZE,SIZE),np.nan,dtype=np.float32)
                reproject(source=rasterio.band(src,1),destination=elevation,
                    src_transform=src.transform,src_crs=src.crs,
                    dst_transform=transform,dst_crs=dest_crs,
                    src_nodata=src.nodata,dst_nodata=np.nan,
                    resampling=Resampling.bilinear,
                    init_dest_nodata=True,
                    num_threads=2)
                valid=np.isfinite(elevation)
                if valid.mean()<0.90:
                    raise ValueError(f"Insufficient NASA LOLA coverage at {name}: {valid.mean():.3f}")
                center=float(np.median(elevation[valid]))
                # NASA file typically gives height above lunar reference sphere;
                # verify scale rather than assume a mis-documented datum.
                datum="height_above_1737.4km_reference_sphere_m"
                if 1.70e6<center<1.77e6:
                    elevation[valid]-=R
                    datum="radius_m_minus_1737400m"
                elif not (-20000<center<20000):
                    raise ValueError(f"Unknown NASA LOLA vertical datum at {name}: median {center}m")
                if np.nanmin(elevation)<-24000 or np.nanmax(elevation)>24000:
                    raise ValueError(f"LOLA height outside broad lunar range at {name}")
                raster=np.full((SIZE,SIZE),-32768,dtype="<i2")
                raster[valid]=np.rint(elevation[valid]).astype("<i2")
                filename="lola-polar-"+name+".bin"
                (OUTPUT/filename).write_bytes(raster.tobytes())
                products.append(dict(id=name,latitude=lat,longitude=lon,
                    binary=filename,valid_fraction=round(float(valid.mean()),6),
                    height_min_m=round(float(np.nanmin(elevation)),1),
                    height_max_m=round(float(np.nanmax(elevation)),1),
                    vertical_datum_interpretation=datum))
                print(name,"valid",float(valid.mean()),"range",products[-1]["height_min_m"],products[-1]["height_max_m"],flush=True)
    metadata={
        "schema_version":1,"source":"NASA GSFC PGDA LOLA LDEM_80S_20MPP_ADJ.TIF",
        "source_url":SRC,
        "reference":"NASA GSFC PGDA A New View of the Lunar South Pole from LOLA",
        "reference_url":"https://pgda.gsfc.nasa.gov/products/90",
        "source_crs":"Moon south polar stereographic, MOON_ME/DE421",
        "patch_crs":"Lunar spherical local azimuthal-equidistant",
        "cell_size_m":CELL,"width":SIZE,"height":SIZE,
        "grid_extent_m":[-5120,-5120,5120,5120],
        "reference_radius_m":R,
        "units":"signed int16 meters above reference sphere",
        "missing":-32768,
        "limitations":"20m DEM derived from LOLA interpolation; only specified 10.24km site patches. Does not prove a safe landing, obstacle-free rover path, or complete skyline beyond patches.",
        "patches":products,"generated_utc":datetime.now(timezone.utc).isoformat()
    }
    (OUTPUT/"lola-polar-detail.json").write_text(json.dumps(metadata,separators=(",",":")),encoding="utf-8")
if __name__=="__main__":main()
