from datetime import datetime, date, time
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from app.models.pass_model import PassType, PassStatus


# --- Request schemas ---

class VisitorDayPassCreate(BaseModel):
    visitor_name: str
    visitor_phone: str
    purpose: str
    visit_date: date
    entry_time: time
    exit_time: time

    @field_validator("visitor_phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 10:
            raise ValueError("Visitor phone number must be exactly 10 digits and contain only numbers.")
        return v

    @field_validator("visit_date")
    @classmethod
    def validate_visit_date(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("Visit date cannot be in the past.")
        return v

    @model_validator(mode="after")
    def validate_times(self) -> "VisitorDayPassCreate":
        if self.exit_time <= self.entry_time:
            raise ValueError("Exit time must be after entry time.")
        return self


class ConferencePassCreate(BaseModel):
    participant_name: str
    participant_email: EmailStr
    participant_phone: str
    conference_name: str
    valid_from: date
    valid_until: date

    @field_validator("participant_phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 10:
            raise ValueError("Participant phone number must be exactly 10 digits and contain only numbers.")
        return v

    @field_validator("valid_from")
    @classmethod
    def validate_valid_from(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("Conference start date cannot be in the past.")
        return v

    @model_validator(mode="after")
    def validate_date_range(self) -> "ConferencePassCreate":
        if self.valid_until < self.valid_from:
            raise ValueError("Conference end date cannot be before start date.")
        return self


class PassApprovalRequest(BaseModel):
    approved: bool
    rejection_reason: Optional[str] = None


# --- Response schemas ---

class ApplicantInfo(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    campus_id: Optional[str] = None

    model_config = {"from_attributes": True}


class PassResponse(BaseModel):
    id: int
    pass_type: PassType
    status: PassStatus
    applicant_id: int
    applicant: Optional[ApplicantInfo] = None
    visitor_name: Optional[str] = None
    visitor_phone: Optional[str] = None
    visitor_email: Optional[str] = None
    purpose: Optional[str] = None
    conference_name: Optional[str] = None
    visit_date: Optional[date] = None
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    entry_time: Optional[time] = None
    exit_time: Optional[time] = None
    rejection_reason: Optional[str] = None
    parent_pass_id: Optional[int] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    used_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class QRGenerateResponse(BaseModel):
    qr_image_base64: str
    token: str
    expires_in_seconds: int


class PermanentPassResponse(BaseModel):
    pass_id: int
    qr_image_base64: str
    holder_name: str
    role: str
    campus_id: Optional[str]
    valid_until: date
