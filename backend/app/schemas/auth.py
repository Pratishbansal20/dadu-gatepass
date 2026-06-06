from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class OTPVerifyRequest(BaseModel):
    phone: str
    otp: str
    pass_id: int

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 10:
            raise ValueError("Phone number must be exactly 10 digits and contain only numbers.")
        return v
