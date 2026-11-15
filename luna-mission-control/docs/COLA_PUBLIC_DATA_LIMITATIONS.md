# LUNA launch-window and public COLA context

The app visualizes a *conceptual* Earth-centered two-body transfer, parameterized in time using Kepler's equation. Moon direction is provided by LUNA's truncated geocentric lunar theory and changes during playback. Earth rotation and the approximate Sun direction are animated. The 3D canvas can be rotated, panned and zoomed.

## Accuracy and validation boundaries

- **Time of flight:** analytic half-ellipse from the selected circular LEO radius to approximate lunar orbital distance; model only, not a solution to a launch window.
- **Moon:** approximate geocentric right ascension and declination from a truncated lunar series, not JPL Horizons state vectors at each time.
- **Sun:** low-order solar direction model, not a JPL ephemeris.
- **Spacecraft:** transfer arc is oriented for visualization near the lunar direction at arrival, but a physically targeted launch/ascent, lunar gravity, lunar orbit insertion and landing are not solved.
- **3D scales:** radial distances are compressed and planet sizes exaggerated so the bodies are visible.
- **Catalog:** only a small public CelesTrak OMM station metadata subset is displayed. Its records include NORAD number and epoch, but the app does not propagate satellite positions or evaluate close approaches.
- **COLA:** no certified conjunction analysis. The FAA definition includes debris and uncataloged objects, plus uncertainty. Public TLE/OMM metadata alone is not adequate. Optional pasted hold intervals are user supplied and unauthenticated.
- **No avoidance solution:** the displayed path is **never** adjusted to dodge a tracked object. Neither the graphics nor the suggested candidate departure timestamps have operational clearance.

## Validation references

- NASA/JPL Horizons: https://ssd.jpl.nasa.gov/horizons/manual.html
- Horizons API vector ephemeris documentation: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- FAA launch collision avoidance advisory AC 450.169-1: https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_450.169-1.pdf
- CelesTrak OMM GP formats: https://celestrak.org/NORAD/documentation/gp-data-formats.php
- CelesTrak usage policy (GP update ~2 hours): https://celestrak.org/usage-policy.php

### Future validation requirements
A real COLA tool must ingest an authorized vehicle ascent/transfer trajectory, planned event timing and uncertainties, catalog plus operator-provided ephemerides and conjunction covariance, and certified launch-window hold reports. This demonstrator intentionally omits that operational pipeline.
