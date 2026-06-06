# Hackathon Submission: BITS Gatepass

An automated, secure, and role-based gate pass management system designed for BITS Pilani campuses.

---

## 1. Problem Statement
Managing campus entry and exit is traditionally slow, insecure, paper-reliant, and highly prone to security breaches. Key issues include:
* **Manual Verification:** Security guards manually record visitor details on paper logs, leading to long entry queues.
* **Identity Fraud:** No verification of visitor phone numbers or details.
* **Lack of Accountability:** Paper logs are difficult to search, audit, or trace in the event of a security incident.
* **Student Friction:** Residents must wait for manual approvals or write slips for basic day-to-day outings.

---

## 2. The Solution: BITS Gatepass
BITS Gatepass is a full-stack, real-time security management system that automates and secures campus checkpoints. It replaces paper registers with:
* **Instant Digital Passes:** Approved visitors receive single-use QR codes.
* **Verify-On-Arrival:** Gates scan QRs which check with our server databases in milliseconds.
* **Automated Auditing:** Every entry, exit, approval, and rejection is automatically logged.
* **Dual-Access Control:** Supports both standard pedestrian QR codes and faculty vehicle RFID systems.

---

## 3. Tech Stack
We built a highly scalable architecture using modern, developer-friendly technologies:
* **Frontend:** Next.js 14, React, Tailwind CSS, Lucide icons, and Zustand (global state).
* **Backend:** FastAPI (Python), SQLAlchemy (ORM), Alembic (migrations), and Pydantic (data verification).
* **Databases:** PostgreSQL (Relational DB for users, passes, and logs) and Redis (Cache for short-lived OTPs and QR codes).
* **Deployment:** Next.js frontend hosted on Vercel, Python backend hosted on Render, PostgreSQL hosted on Supabase, and Redis hosted on Upstash.

---

## 4. User Roles and Capabilities

To simulate a real-world campus ecosystem, we built six custom user interfaces:

### Student
* Apply for Visitor Day Passes for guests by entering their details.
* View status of requested passes.
* Access their auto-generated Resident Pass with an embedded QR code for daily gate access.

### Faculty
* Request multi-day Conference Passes for event participants.
* Register personal vehicles with RFID tag values.

### Hostel Superintendent
* Review, approve, or reject Visitor Day Pass requests submitted by students.

### Conference Supervisor
* Review, approve, or reject multi-day Conference Passes submitted by faculty.

### Gate Security
* Scan visitor/student QR codes via the web dashboard.
* Verify incoming vehicles by entering their RFID tag numbers.
* View live logs of today's entries and exits.

### Super Admin
* Activate or revoke vehicle RFID tags.
* Manage user accounts (activate or deactivate users).
* View the complete, unalterable system Audit Trail.

---

## 5. Security Measures (Simplified)

We designed this system to resist common security exploits:

* **No Replay Attacks (Single-Use QRs):** QR codes are single-use. When scanned at the gate, the token is checked against Redis and immediately deleted. Re-scanning the same QR code will reject entry.
* **Cryptographically Signed QRs:** The QR code embeds a signed JSON Web Token (JWT) containing the pass ID and visitor details. Even if a visitor attempts to alter the QR image or content, the gate scanner will reject it.
* **OTP Phone Validation:** When a superintendent approves a pass, an OTP is generated. The visitor must verify their phone number with the OTP to receive their QR code, preventing fake registrations.
* **Database Security:** Cloud-hosted PostgreSQL with encrypted password hashing (using bcrypt) protects user accounts.

---

## 6. Live Presentation Flow for Judges

To demonstrate the full-stack flow to the judges, follow this sequence:

### Part A: Student Guest Request
1. Log in as **Student** (`student@bits.ac.in` / `Student@123`).
2. Click **New Request** under Visitor Day Passes, fill in visitor details, and submit.
3. Log out.

### Part B: Superintendent Approval
1. Log in as **Hostel Superintendent** (`superintendent@bits.ac.in` / `Super@123`).
2. You will see the student's request. Click **Approve**.
3. (In dev mode, the OTP code will print to the backend Render console logs).

### Part C: Visitor Verification
1. Open the verification page for the pass.
2. Enter the visitor's phone number and the OTP code to simulate a visitor verifying their identity.
3. The screen will instantly display a secure, scan-ready QR code.

### Part D: Gate Security Scan
1. Log in as **Gate Security** (`gate@bits.ac.in` / `Gate@123`).
2. Scan the QR code (or submit the token). The dashboard will verify the pass and display a success checkmark.
3. The pass is now marked as `USED` and cannot be scanned again.

### Part E: Admin Audit Review
1. Log in as **Super Admin** (`admin@bits.ac.in` / `Admin@123`).
2. Go to the **Audit Logs** tab to show the judges that every action (request, approval, verification, scan) has been permanently recorded with timestamps.
