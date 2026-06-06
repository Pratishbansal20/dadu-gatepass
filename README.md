# BITS Gatepass

Production-grade campus gate pass management system for BITS Pilani. Supports multiple user roles, visitor pass workflows with OTP verification, QR code-based entry, RFID vehicle access, and full audit logs.

## Tech Stack
* **Frontend:** Next.js 14, React, Tailwind CSS, Lucide Icons, Zustand
* **Backend:** FastAPI (Python 3.12+), SQLAlchemy 2.0+, Alembic, Pydantic v2
* **Databases:** PostgreSQL, Redis

## Features
* **Role-Based Access:** Configured for Student, Faculty, Hostel Superintendent, Conference Supervisor, Gate Security, and Super Admin.
* **Visitor Day Pass:** Student-applied guest passes with OTP verification and single-use QR codes.
* **Conference Pass:** Faculty-applied multi-day passes approved by Conference Supervisors.
* **RFID Vehicle Access:** Faculty vehicle tag registration approved by Super Admin.
* **Gate Control Panel:** Security dashboard to scan QR codes and lookup RFID vehicles.
* **Audit Trail:** Security log tracking all significant database operations.

## Environment Configuration

Create a `.env` file in the `backend/` directory based on the following variables:

```env
ENV=development
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
SECRET_KEY=...
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
SWD_API_KEY=...
APP_NAME=BITS Gatepass
CORS_ORIGINS=http://localhost:3000
```

## Getting Started

### Local Setup (Cloud Databases or Local Services)

1. **Clone the Repository:**
   ```bash
   git clone <repo-url> && cd dadu-gatepass
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   alembic upgrade head
   python seed.py
   uvicorn app.main:app --reload --port 8000
   ```

3. **Frontend Setup:**
   ```bash
   cd ../frontend
   npm install
   echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
   npm run dev
   ```

### Docker Setup

To run the full stack locally with containerized PostgreSQL and Redis:
```bash
docker-compose up --build
```

Access the applications at:
* **Frontend:** http://localhost:3000
* **API Documentation:** http://localhost:8000/api/docs

## Seeded Demo Credentials

Use these credentials to log in and test different dashboard interfaces:

| Role | Email | Password |
| :--- | :--- | :--- |
| Super Admin | admin@bits.ac.in | Admin@123 |
| Student | student@bits.ac.in | Student@123 |
| Faculty | faculty@bits.ac.in | Faculty@123 |
| Hostel Superintendent | superintendent@bits.ac.in | Super@123 |
| Conference Supervisor | confsup@bits.ac.in | ConSup@123 |
| Gate Security | gate@bits.ac.in | Gate@123 |
