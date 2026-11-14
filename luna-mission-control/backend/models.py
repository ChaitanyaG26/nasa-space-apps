from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field, field_validator

class MissionRequest(BaseModel):
    latitude: float = Field(default=-89.5, ge=-90, le=90)
    longitude: float = Field(default=0, ge=-180, le=180)
    landing_time: datetime
    duration_days: int = Field(default=7, ge=1, le=21)
    area_m2: float = Field(default=1.6, gt=0, le=100)
    panel_tilt_deg: float = Field(default=60, ge=0, le=90)
    panel_az_deg: float = Field(default=0, ge=0, le=360)
    battery_wh: float = Field(default=5000, gt=0, le=500000)
    load_w: float = Field(default=75, gt=0, le=5000)
    reserve_percent: float = Field(default=20, ge=0, le=90)
    data_mode: Literal['demo','horizons'] = 'demo'

    @field_validator('landing_time')
    @classmethod
    def ensure_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError('landing_time must include a UTC offset')
        return value.astimezone(timezone.utc)

class OptimizeRequest(BaseModel):
    mission: MissionRequest
    preserve: Literal['site','time']
