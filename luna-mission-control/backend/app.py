from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .models import MissionRequest, OptimizeRequest
from .science import preview, run_mission
from .optimizer import optimize
from .horizons import HorizonsError

ROOT=Path(__file__).resolve().parents[1]
WEB=ROOT/'web'
app=FastAPI(title='LUNA Mission Control',version='0.1.0',description='Lunar globe and preliminary mission scenario prototype')

def safe_run(func,*args):
    try:return func(*args)
    except HorizonsError as e:raise HTTPException(status_code=503,detail=f'NASA Horizons unavailable: {e}. Switch to Offline illustrative mode to test the interface.') from e
    except ValueError as e:raise HTTPException(status_code=422,detail=str(e)) from e

@app.get('/api/health')
def health():return {'status':'ok','version':'0.1.0'}

@app.post('/api/preview')
def get_preview(mission:MissionRequest):return safe_run(preview,mission)

@app.post('/api/simulate')
def simulate(mission:MissionRequest):return safe_run(run_mission,mission)

@app.post('/api/optimize')
def get_optimization(payload:OptimizeRequest):
    if payload.mission.data_mode=='horizons':
        raise HTTPException(status_code=422,detail='Optimization is available in labeled offline demonstration mode only. NASA optimization requires precomputed ephemeris and terrain caches.')
    return safe_run(optimize,payload.mission,payload.preserve)

app.mount('/assets',StaticFiles(directory=WEB/'assets'),name='assets')

@app.get('/')
def index():return FileResponse(WEB/'index.html')

@app.get('/styles.css')
def css():return FileResponse(WEB/'styles.css')

@app.get('/app.js')
def js():return FileResponse(WEB/'app.js',media_type='application/javascript')

@app.get('/globe.js')
def globe():return FileResponse(WEB/'globe.js',media_type='application/javascript')

@app.get("/static-engine.mjs")
def static_engine():
    return FileResponse(WEB/"static-engine.mjs",media_type="application/javascript")
