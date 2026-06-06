# BITS Gatepass

Production-grade campus gate pass management system for BITS Pilani. Supports multiple user roles, visitor pass workflows with OTP verification, QR code-based entry, RFID vehicle access, and a full audit trail.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                         Browser                            │
│              Next.js 14 App (port 3000)                    │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTP (REST)
┌──────────────────────────▼─────────────────────────────────┐
│               FastAPI Backend (port 8000)                   │
│    /api/v1/*   — JWT-authenticated internal API            │
│    /api/swd/v1/* — API-key authenticated SWD routes        │
└──────────────┬────────────────────────┬────────────────────┘
               │                        │
┌──────────────▼──────┐   ┌────────────▼──────────┐
│   PostgreSQL (5432) │   │   Redis (6379)          │
│   Persistent data   │   │   OTP TTL 5min          │
│   All pass records  │   │   QR token TTL 10min    │
│   Audit logs        │   │                         │
└─────────────────────┘   └─────────────────────────┘
```

**Key design decisions:**
- All business logic lives in `services/`, route handlers are thin
- QR codes are never stored in the DB — generated on-demand, Redis-backed single-use
- OTP flow is mocked but architected for a real SMS provider drop-in
- Separate SWD API router with API key auth (not JWT) for service-to-service calls
- Full audit log on every significant action

---

## Setup — Docker (recommended)

```bash
# 1. Clone
git clone <repo-url> && cd dadu-gatepass

# 2. Create backend .env
cp backend/.env.example backend/.env

# 3. Start everything (DB + Redis + Backend + Frontend)
make dev

# 4. The backend auto-runs migrations and seeds demo users on startup
#    Watch the backend logs for the seeded credentials table
make logs
```

Visit:
- **Frontend** → http://localhost:3000
- **API Docs** → http://localhost:8000/api/docs
- **API Redoc** → http://localhost:8000/api/redoc

---

## Setup — Manual (no Docker)

### Backend

```bash
cd backend

# Create virtualenv
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install deps
pip install -r requirements.txt

# Copy and edit .env
cp .env.example .env
# Edit DATABASE_URL and REDIS_URL to point to your local instances

# Run migrations
alembic upgrade head

# Seed demo users
python seed.py

# Start server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
# Set NEXT_PUBLIC_API_URL in .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

---

## Seeded Demo Credentials

| Role                 | Email                         | Password    |
|----------------------|-------------------------------|-------------|
| Super Admin          | admin@bits.ac.in              | Admin@123   |
| Student              | student@bits.ac.in            | Student@123 |
| Faculty              | faculty@bits.ac.in            | Faculty@123 |
| Hostel Superintendent| superintendent@bits.ac.in     | Super@123   |
| Conference Supervisor| confsup@bits.ac.in            | ConSup@123  |
| Gate Security        | gate@bits.ac.in               | Gate@123    |

---

## User Roles & Permissions

| Role                  | Can Do                                                              |
|-----------------------|---------------------------------------------------------------------|
| STUDENT               | Apply for visitor day passes, view own passes, get permanent pass  |
| FACULTY               | Apply for conference passes, register RFID vehicle                 |
| HOSTEL_SUPERINTENDENT | Approve/reject visitor day passes                                  |
| CONFERENCE_SUPERVISOR | Approve/reject conference participant passes                        |
| GATE_SECURITY         | Scan QR codes, scan RFID tags, view active passes and today's log  |
| SUPER_ADMIN           | All of the above + user management + full audit log                |

---

## Pass Types

### 1. Permanent Resident Pass
Generated automatically when a student or faculty account is created. No approval needed. QR is generated on-demand and embedded in the pass card in the dashboard.

### 2. Visitor Day Pass (Student-applied)
1. Student submits visitor info (name, phone, purpose, date, time window)
2. Hostel Superintendent approves or rejects
3. On approval → OTP sent to visitor's phone (see console log in dev mode)
4. Visitor visits `/verify/{pass_id}`, enters phone + OTP
5. Single-use QR code generated (10-min TTL)
6. Gate security scans QR — pass marked USED, Redis key deleted

A **Hostel Sub-pass** is automatically created and linked to the main pass, so gate security sees both the campus entry clearance and the hostel destination in one scan.

### 3. Conference Participant Pass (Faculty-applied)
Same flow as Visitor Day Pass but:
- Faculty applies with participant details and conference date range
- Conference Supervisor approves
- Multi-day: OTP is sent on approval, QR is valid for the duration

### 4. Vehicle RFID Pass (Faculty-applied)
1. Faculty submits vehicle number, model, and RFID tag number
2. Super Admin activates the tag
3. Gate Security enters tag number in the RFID scanner panel
4. System returns vehicle + faculty info instantly

---

## How the QR Single-Use System Works

```
APPROVAL
   │
   ▼
OTP generated → stored in Redis (key: otp:{phone}, TTL: 5min)
   │
   ▼
Visitor hits /verify/{pass_id} → enters phone + OTP
   │
   ▼
Backend: otp_service.verify() → checks Redis, deletes key on match
   │
   ▼
qr_service.generate_qr() → creates signed JWT payload:
   { pass_id, visitor_phone_last4, issued_at, exp }
   │
   ▼
Token stored in Redis (key: qr:{token}, TTL: 10min)
QR image (base64 PNG) returned to visitor
   │
   ▼
Gate officer scans QR → POST /api/v1/gate/scan/qr?token=...
   │
   ▼
Backend:
  1. Decode JWT signature (rejects forged tokens)
  2. Check Redis key exists (rejects expired tokens)
  3. DELETE Redis key (prevents replay attacks)
  4. Mark pass.status = USED in DB
  5. Return pass details to gate officer
```

If the Redis key is missing (already scanned or expired), the scan returns a clear error. The JWT signature check prevents token forgery even if Redis is somehow bypassed.

---

## How the RFID Simulation Works

RFID tags are modeled as database records with statuses: `PENDING → ACTIVE → REVOKED`.

Faculty submits a tag number (simulating what they'd read off a physical RFID tag). Admin activates it. Gate security enters the tag number into the RFID scanner panel — the backend looks up the tag and returns vehicle + owner info. Every scan is logged to the audit trail regardless of outcome.

In a production deployment with real RFID hardware, the POST `/api/v1/gate/scan/rfid` endpoint would be called by the hardware controller instead of the browser.

---

## SWD Integration Guide

The Student Welfare Division (SWD) integration API lives at `/api/swd/v1/`. It uses API key authentication (not JWT) — include the key in the `X-API-Key` header on every request.

**API Key:** Set `SWD_API_KEY` in the backend `.env`. Default dev value: `swd-secret-api-key`.

### Auth Handshake

```
POST /api/swd/v1/auth/token
Headers: X-API-Key: <swd-api-key>
Body: { "student_id": "2021A7PS001P", "api_secret": "<swd-api-key>" }

Response: { "access_token": "...", "student_id": "...", "student_name": "..." }
```

The `access_token` is a scoped JWT (role=STUDENT). Use it as a Bearer token when calling the main `/api/v1/` endpoints on behalf of the student.

### Endpoint Contracts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/swd/v1/auth/token` | API Key | Get scoped student JWT |
| GET | `/api/swd/v1/passes/student/{student_id}` | API Key | All passes for a student |
| GET | `/api/swd/v1/passes/{pass_id}/status` | API Key | Poll approval status |
| POST | `/api/swd/v1/passes/{pass_id}/qr` | API Key | Validate OTP + get QR |

### Assumed SWD Implementation

SWD is assumed to:
1. Maintain a mapping of campus student IDs to their profiles
2. Store the shared SWD API key securely (not in app code)
3. Poll `/passes/{pass_id}/status` after submission to detect approval
4. Collect OTP from the visitor and call `/passes/{pass_id}/qr` to get the QR image
5. Display the base64 QR image to the visitor (it's a standard PNG)

Full OpenAPI docs are available at `http://localhost:8000/api/docs`.

---

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make dev` | Build and start all services |
| `make seed` | Re-run the seed script |
| `make logs` | Tail all container logs |
| `make stop` | Stop all containers |
| `make clean` | Remove containers and volumes (resets DB) |
| `make migrate` | Run Alembic migrations |
| `make shell-backend` | Open a shell in the backend container |
| `make shell-db` | Open psql in the DB container |

---

## Dev Utilities

**Get current OTP for a phone number** (development mode only):
```
GET http://localhost:8000/api/v1/auth/dev/otp/{phone}
```

**OTP is also printed to the backend console** with a clear label:
```
==================================================
[OTP SERVICE] Phone: 9000000002 | OTP: 847291
==================================================
```

---

## Deployment (Railway / Render)

1. Set up PostgreSQL and Redis add-ons
2. Set environment variables from `.env.example`
3. Deploy backend as a web service (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`)
4. Deploy frontend as a static/Node service (`npm run build && npm start`)
5. Set `NEXT_PUBLIC_API_URL` to the backend's public URL
6. Set `CORS_ORIGINS` to the frontend's public URL

The backend runs `alembic upgrade head` and `seed.py` automatically on startup (see `Dockerfile CMD`).
