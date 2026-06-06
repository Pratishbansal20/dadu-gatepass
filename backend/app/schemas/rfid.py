from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.rfid import RFIDStatus


class RFIDTagCreate(BaseModel):
    tag_number: str
    vehicle_number: str
    vehicle_model: str


class RFIDTagResponse(BaseModel):
    id: int
    tag_number: str
    vehicle_number: str
    vehicle_model: str
    faculty_id: int
    status: RFIDStatus
    activated_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RFIDScanRequest(BaseModel):
    tag_number: str


class RFIDScanResponse(BaseModel):
    tag_number: str
    vehicle_number: str
    vehicle_model: str
    faculty_name: str
    faculty_email: str
    faculty_phone: str
    status: RFIDStatus
