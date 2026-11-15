<img width="1024" height="769" alt="image" src="https://github.com/user-attachments/assets/a291d69c-afb9-4033-8d85-0d73ef147861" />
# LUNA — Moon Mission Control

**Launch the interactive website at https://lunacontrol.earth/**

## Table of Contents
- [Table of Contents](#table-of-contents)
- [Mission and Relevance](#mission-and-relevance)
- [Widget Usage Guide](#widget-usage-guide)
- [Code and Limitations](#code-and-limitations)

## Mission and Relevance
The goal of our mission planner is to allow a visitor to quickly compare the efficacy of rough landing location and time parameters (ie, as in the possibility of a 1- to 35-day mission for those given inputs), and create two other alternatives (one which preserves the same landing location, if the priority is to search/analyze/observe that *specific* area, and one which preserves the same landing time, if the priority is to reach the Moon by that *specific* time). We achieve this through various factors, whilst providing a few details on how such can be achieved (ie, choosing a specific location as the launch point, an animation of the orbit of a chosen rocket with a chosen payload, and the launch time projections, among other things).

Now, the chosen graphs have more information explaining them (when you click the i-icon); however, here is a brief summary of each graph and its relevance when planning a lunar mission:

1. Solar generation: for solar-powered lunar missions, different locations and times offer different illumination opportunities (based on the angle of the sun at the horizon), this shows you if you get enough power.

2. Battery charge: a simpler organization of the above tool, allows you to see the range of operation of your lander/mission during the first few days. 0% battery charge means modeled energy is depleted; it does not establish an automatic hibernation requirement.

3. Regolith temperature: some landers need to hibernate at extremely cold or extremely hot temperatures. This graph allows you to see what could potentially be a range of operation.

4. Lander thermal model: a view of the LANDER's own overheating/overcooling, to make the aforementioned clearer given your inputs for the spacecraft.

5. Heater power: showcases how much power consumption you can expect over the course of your mission.

6. S-band RF margin: an assumed S-band link-budget margin using hypothetical transmitter and Earth receiver specifications, not a guaranteed contact.

7. Diviner archival temperature: historical temperature observations, a rough view of how temperatures might look during the mission.

8. Earth terrain clearance: showcases when there is a direct-to-Earth line of sight; this and (6) S-band RF margin need to be above minimum thresholds for communication to be possible.

9. A terrain map of the chosen landing location, color-coded based on slope, and exaggerated vertically (6x by default).

10. COLA (unverified) and a theoretical orbit animation.

11. A launch animation and a landing animation, on exaggerated terrain, rendering the proper sun location on the horizon.

On the main page, we have selectors for date and time (which move the moon-centered directions 3d view appropriately, alongside the local terrain horizon view, and change the shading on the render), and a 3D view of the moon you can pan through (where clicking chooses your location, hovering over a historic landing gives you information about it, and where coordinates of your selected location are given.

You may also update the spacecraft assumptions and engineering screening assumptions dropdowns on the main page to examine how projected values and the candidate ranking change with your assumptions; these inputs do not independently validate a spacecraft.

## Widget Usage Guide
The widget can be used on both computer and mobile. This is a guide for computer, although mobile users have the same features and buttons (just more scrolling).

<img width="1920" height="915" alt="image" src="https://github.com/user-attachments/assets/13df9044-c51a-4499-9800-99452c1f5be5" />

We start with the left sidebar, which has a mission timing button. The calendar allows you to choose a date, the slider the time, and the moon-centered directions give you a 3D view of relative positions. The local terrain horizon shows you local terrain at your specified location.

You can pan across the globe; hovering over past missions gives you detail over them; clicking locations sets them as your landing location.

Clicking "simulate mission" yields you the data.
<img width="1920" height="919" alt="image" src="https://github.com/user-attachments/assets/8d222c49-da96-45bc-a9c7-e3ef61b17876" />

Clicking the i-icon gives you more information about the graphs. Fullscreen allows you to see the graphs in full screen. Hovering over the graph gives you the ability to see the reading change over time.
<img width="459" height="707" alt="image" src="https://github.com/user-attachments/assets/5a6a6ac7-b88c-4da4-8c8e-572fef537131" />

4 specific values are provided for each case: the solar energy, the length of the longest blackout, the minimum battery, and the Earth visibility.

<img width="931" height="898" alt="image" src="https://github.com/user-attachments/assets/3bf2f6cd-f540-4726-9c1d-1abbf04b632c" />
The terrain map gives you the ability to pan across the terrain. You can choose the area shown and the vertical exaggeration, alongside the terrain layer (LOLA elevation/slope or an unassessed seismic-evidence view).

<img width="925" height="589" alt="image" src="https://github.com/user-attachments/assets/e2f233b4-f31d-4ce8-8cdd-6766250b6017" />
There is then an animation for the orbit of the spacecraft, given inputs (launch range as the starting point, the "parking altitude," the range to search across for the launch, etc). Clicking "find departure windows lets you see the departure windows."

<img width="1357" height="501" alt="image" src="https://github.com/user-attachments/assets/5afacc85-240b-42a3-8535-c91ac2c618f3" />
There are two final animations at the bottom; you may choose the rocket, the payload, or the lander. Then, click the bottom-right icon to scroll back to the top and click "Optimize and compare".

<img width="1920" height="917" alt="image" src="https://github.com/user-attachments/assets/0d382a27-5785-4663-8961-c2f608e92735" />
The leftmost uses your inputs; the middle of the three columns uses your landing schedule but optimizes the site; the rightmost uses your site but optimizes the landing schedule.

You may click the information button to the right OR the methods & sources hyperlink OR the information button next to the return to globe button to view information on how our data was collected.
<img width="1920" height="919" alt="image" src="https://github.com/user-attachments/assets/9974beca-29c1-4fa1-b6b8-880167789a23" />

You may click Return to Globe to Return to the Globe. Or, if you want to restore the widget back to the original inputs, simply click the "Restart Mission" button.


## Code and Limitations
There is a variety of data used for the website; LOLA elevations and Diviner thermal bins are from **archived** NASA data, while most of the animations/sun/earth/moon views use JPL Horizons reference ephemerides (essentially a database predicting the motion of the three bodies over time), and calculations bridging the two (like the orbital animation, which we **cannot** run an actual COLA - *col*lision *a*voidance - and is thus a preliminary look at how a path MIGHT look, or the energy storage/S-band margin data, which requires assumptions to be UPDATED in the spacecraft assumptions tab to be accurate to a specific mission).

The default mission values for the interface are summarized in the table below:
### Default Mission Configuration
| Input Parameter | Default Value |
| :--- | :--- |
| **Landing Site** | 89.5° S, 0° E |
| **Landing UTC** | 2026-11-20, 12:00 |
| **Mission Duration** | 7 days *(options: 1–35 days)* |
| **Solar Array** | • **Size:** 1.6 m²<br>• **Tilt:** 60°<br>• **Azimuth:** 0° |
| **Battery & Load** | • **Capacity:** 5,000 Wh<br>• **Load:** 75 W<br>• **Reserve:** 20% |
| **Thermal** | • **Capacity:** 120 kJ/K<br>• **Radiator:** 0.35 m²<br>• **Heater:** 80 W<br>• **Setpoint:** -5°C |
| **RF** | • **TX:** 5 W<br>• **Gain:** +8 dBi<br>• **Ground G/T:** +25 dB/K<br>• **Data Rate:** 10 kb/s<br>• **Margin:** 3 dB threshold |
| **Model Step** | 30 minutes |

The code functions in the following manner:

1. We collect the user's inputs for time and location (with web/app.js validating the mission request values and throwing an error when "simulated" is necessary - primarily used when outside of the current data range).

2. We use web/horizons-static.mjs (the JPL Horizons data) to load the local ephemerides for the views on the first page; we then use web/lola-global.mjs and web/lola-polar-detail.mjs (the LOLA data) to project the local horizon/terrain and the views of the Earth and Sun from the chosen location.

3. When "simulate" is clicked, we use web/static-engine.mjs to evaluate the angle of the Sun to predict panel output, state of charge, thermal/RF projections from data, communication metrics, and load other relevant data to actually generate the graphs from above.

4. Then, we use the historical data to match older measurements with web/diviner-gcp.mjs (the Diviner archived temperature).

5. Then, we load visual outputs with the data above with web/science-charts.mjs, web/terrain-3d.mjs, and web/globe.js, alongside the mission animation render results. This is the step where we take the data fetched/processed above and actually make it into graphs.

6. Launch extension: we run launch-window.mjs to actually show the Earth-Moon orbit playback, rocket ascent/lunar lander descent scenes.

7. Optimization: when "optimize and compare" is run, we call two different optimizations — one that preserves the location, and one that preserves the schedule. We evaluate candidates with the logic below and showcase the best alternatives.

This is all laid out with our multiple directories. web/ holds the UI, the WebGL/canvas, the functions, and the cached data; web/assets/ holds the arrays, metadata, and JPL/moon surface reports; backend/ holds the optimizer implementation, Horizon queries, request models, etc.; scripts/ holds the binary cache generation, live deployment checks, data download/validation, etc.; tests/ holds the JavaScript numerical/unit/etc. tests and Python/science tests; .github/worflows/ holds the GitHub Pages deployment; index.html/CNAME holds the fallback/custom domain.

The logic for optimization:

1. We assign a score to each observed value: 60% from the solar energy, 40% from the RF availability, and minimum state of charge as the tiebreaker (when RF data is not present, we use the Earth-visibility scores instead).

2. We screen up to 512 south-polar site candidates for the location optimization, including local neighborhoods near the four high-resolution LOLA patches; this is not a global optimum. For a fixed site, we sample dates every 3 hours over ±14 days, skipping intervals outside the cached NASA ephemeris range. Candidates are first screened at a 60-minute model step, then the top 16 are recalculated at the selected timestep.

3. The optimized candidate is thus an amalgamation of the user inputs and the time/location candidate list — we **cannot** establish mission feasibility without a validated vehicle, spacecraft design, ground network, terrain hazard assessment and authorized operational data (thus, they are only projections for how an optimal value MIGHT look).

We use three supported launch ranges: Kennedy Space Center (LC-39, the default); Cape Canaveral Space Force Station; Vandenberg Space Force Base; which are representative U.S. orbital launch ranges, not a complete or preapproved list of lunar departure sites. Departure times are generated here with the arrival UTC as the target, and approximate Moon-Earth positions are used to measure the two-body half-ellipse transfer time (Kepler's third law!), and shifting around the appropriate time with candidates every 60 minutes, yielding preliminary educational departure estimates rather than operational launch windows.

We do not have debris, probability of collision, among other things; we do NOT have COLA since we don't have enough data to actually REASONABLY establish COLA. The animations below the orbit showcase different rocket and lander silhouettes (the most common ones, at least: the Falcon 9, Falcon Heavy, SLS Block 1, Vulcan Centaur, Atlas V, Firefly Alpha; the Blue Ghost, Nova-C, Peregrine, generic), with different values/assumptions.

We require WebGL/Canvas for the views here (and thus, low-memory phones and GPU drivers might change how it is viewed); we require loading large cached assets, so it often takes a few seconds for the page to fully load; automated responsive and numerical checks exist, but behavior across all physical browsers/devices has not been fully verified.

### Limitations:
1. As noted above, "optimized" is not a global optimum but a ranked value from a finite 512-site grid or 3-hour date search, not a global optimum or a vetted landing site.

2. Thermal performance metrics haven't exactly been tested/validated; there are a myriad of assumptions required to establish these with the data we have been provided.

3. Launch/COLA cannot be provided by our program.

4. We use vertical terrain exaggeration often, which IS noted on the website but may affect a user unfamiliar with the layout; lighting/thrust/model scale are not exactly proportional or photorealistic in all cases, but are altered for visibility (for example, the dark side of the moon is much brighter than it should be).

5. Failed data is supposed to produce errors, but some can be misinterpreted: missing local terrain does not mean flat or safe ground, and archived Diviner bins do not measure the selected future mission.

However, the result is the same; you can compare rough values for each landing position/schedule to generate some (possibly better) candidates.
