from fastapi.testclient import TestClient
from backend.app import app
client=TestClient(app)
PAYLOAD={'landing_time':'2026-11-20T12:00:00Z','latitude':-89.5,'longitude':0,'duration_days':1}
def test_health():assert client.get('/api/health').json()['status']=='ok'
def test_preview():
    r=client.post('/api/preview',json=PAYLOAD)
    assert r.status_code==200
    assert 'OFFLINE' in r.json()['source']
def test_simulate():
    r=client.post('/api/simulate',json=PAYLOAD)
    assert r.status_code==200
    assert len(r.json()['samples'])==25
def test_optimizer():
    r=client.post('/api/optimize',json={'mission':PAYLOAD,'preserve':'time'})
    assert r.status_code==200
    assert r.json()['recommended']['landing_time']==PAYLOAD['landing_time'].replace('Z','+00:00')
def test_reject_live_optimization():
    r=client.post('/api/optimize',json={'mission':{**PAYLOAD,'data_mode':'horizons'},'preserve':'site'})
    assert r.status_code==422
