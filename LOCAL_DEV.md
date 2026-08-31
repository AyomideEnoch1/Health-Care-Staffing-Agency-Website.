# LOCAL DEVELOPMENT GUIDE
## Divine Fingers Healthcare Services Inc. — Backend API

---

## Prerequisites

- **Node.js 20+** — `node --version`
- **MySQL 9.x** via WAMP64 installed at `C:\wamp64\`
- **npm** — bundled with Node.js

---

## 1. Start MySQL (WAMP)

WAMP's service may be stopped. Start MySQL manually:

```powershell
Start-Process -FilePath "C:\wamp64\bin\mysql\mysql9.1.0\bin\mysqld.exe" `
  -ArgumentList '--defaults-file="C:\wamp64\bin\mysql\mysql9.1.0\my.ini"' `
  -WindowStyle Hidden
```

Verify it's running:
```powershell
Test-NetConnection 127.0.0.1 -Port 3306
# TcpTestSucceeded: True = MySQL is running
```

---

## 2. Create the Database & Schema

```powershell
"C:\wamp64\bin\mysql\mysql9.1.0\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS divine_fingers_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
"C:\wamp64\bin\mysql\mysql9.1.0\bin\mysql.exe" -u root divine_fingers_dev < schema.sql
```

---

## 3. Configure Environment

Copy `.env.local.example` to `.env`:

```powershell
Copy-Item .env.local.example .env
```

The `.env` file is gitignored. Edit it to match your local environment:

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=divine_fingers_dev
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_EXPIRES_IN=8h
SMTP_HOST=127.0.0.1
SMTP_PORT=1025        # Mailhog local SMTP port
NODE_ENV=development
PORT=3000
```

---

## 4. Install Dependencies

```powershell
npm install
```

---

## 5. Seed the Admin Account

This creates ONE test admin login. Clearly non-production — the email is
`admin@divinefingershealthcare.ca` with password `AdminSecure2026!`.

```powershell
node scripts/seedAdmin.js
```

> **⚠️ Staff Roster is Empty by Design.**
> The `staff_roster` table starts with zero rows. No fake nurse/PSW names are seeded.
> The **Roster**, **Compliance**, and **Scheduler** dashboard modules will show honest
> empty states until you add real staff. To add staff, contact the development team
> for the roster CSV import script, or insert directly:
> ```sql
> INSERT INTO staff_roster (id, staff_code, name, role, specialty, region, hourly_rate, cpr_expiry_date, shifts_completed)
> VALUES (UUID(), 'STF-001', 'Your Staff Name', 'RN', 'ICU', 'Scarborough', 45.00, '2026-12-31', 0);
> ```

---

## 6. Start the API Server

```powershell
node server.js
# OR for auto-reload:
npm run dev
```

Output should show:
```
🚀 Divine Fingers Healthcare API running on http://localhost:3000
✅ [Database] Connected to MySQL (127.0.0.1:3306/divine_fingers_dev)
```

---

## 7. Access the Admin Dashboard

**IMPORTANT:** Always access admin through `http://localhost:3000/admin.html`
(not by opening the file directly). The httpOnly session cookie requires
the request to go through the Node.js server.

```
http://localhost:3000/admin.html
```

Login credentials:
- **Email:** `admin@divinefingershealthcare.ca`
- **Password:** `AdminSecure2026!`

---

## 8. Test the Full Data Flow

Submit real data through the public forms:

| Form | URL | Expected result |
|---|---|---|
| Staffing Request | `http://localhost:3000/clients.html` | Appears on Admin Kanban within 3 seconds (SSE) |
| Job Application | `http://localhost:3000/jobseekers.html` | Appears in ATS pipeline tab live |
| Contact Inquiry | `http://localhost:3000/contact.html` | Appears in Messages tab |

After submitting a form, the admin dashboard should show a **toast notification**
and the relevant KPI card should update — without a page refresh.

---

## 9. Verify SSE Reconnect Behaviour

1. Log in to the admin dashboard
2. Kill the server (`Ctrl+C`)
3. A yellow **"Reconnecting to live stream..."** bar should appear at the top of the dashboard
4. Restart the server (`node server.js`)
5. The bar should disappear within ~10 seconds and the dashboard should refresh

---

## 10. Email Testing (Local)

The `.env` defaults to Mailhog on port 1025. Install and run Mailhog:
- Download: https://github.com/mailhog/MailHog/releases
- Run: `.\MailHog.exe`
- Web UI: `http://localhost:8025`

No real emails are sent in development.

---

## 11. API Quick Reference

```
GET  http://localhost:3000/api/health          # DB + API liveness check
POST http://localhost:3000/api/auth/login       # Sets httpOnly session cookie
POST http://localhost:3000/api/auth/logout      # Clears cookies
POST http://localhost:3000/api/requests         # Submit staffing request (public)
POST http://localhost:3000/api/applications     # Submit resume application (public)
POST http://localhost:3000/api/contact          # Submit contact inquiry (public)
GET  http://localhost:3000/api/admin/kpis       # Live KPI aggregates (auth required)
GET  http://localhost:3000/api/admin/requests   # All staffing requests (auth required)
GET  http://localhost:3000/api/admin/roster     # Staff roster (auth required)
GET  http://localhost:3000/api/admin/stream     # SSE real-time stream (auth required)
```

---

## Technical Notes

**JWT Authentication:** Uses httpOnly cookies (`df_admin_session`). You cannot read
the token via JavaScript — this is intentional security. The CSRF token (`df_csrf_token`)
is a separate readable cookie sent as `X-CSRF-Token` header on PATCH/POST requests.

**No mock data:** The dashboard shows honest empty states when the database has no records.
This is correct behaviour. Submit forms to populate it.

**IP Address Retention:** `ip_address` columns in all tables are retained for a
recommended maximum of **90 days** (configurable via `IP_RETENTION_DAYS` env var).
A scheduled purge job to nullify old IP addresses is a separate operational requirement.

**Technical safeguards** in this system are aligned with PHIPA/PIPEDA principles.
Legal/privacy compliance (data retention policy, breach procedures, privacy officer
designation) requires separate non-technical review not covered by this build.
