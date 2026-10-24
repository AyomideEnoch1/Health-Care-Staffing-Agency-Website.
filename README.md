# Divine Fingers Healthcare Services Inc.

A secure, enterprise-grade healthcare staffing platform and dispatch management system.

---

## 📁 Project Architecture

```
project/
│
├── frontend/
│   ├── src/
│   │   ├── index.html            # Main Landing / Homepage
│   │   ├── about.html            # About Divine Fingers
│   │   ├── clients.html          # Facility Client Services
│   │   ├── jobseekers.html       # Healthcare Careers / Apply
│   │   ├── services.html         # Clinical Staffing Capabilities
│   │   ├── contact.html          # Contact & Inquiries
│   │   ├── blog.html             # Healthcare Insights & Articles
│   │   ├── bulk-staffing.html    # Emergency / Surge Staffing Order
│   │   ├── login.html            # Unified Client & Clinician Authentication
│   │   ├── admin-login.html      # Secure Administrator Gateway
│   │   ├── portal.html           # Clinician & Client Operations Portal
│   │   ├── style.css             # Core Brand Design System
│   │   ├── prototype.css         # Portal Component Styles
│   │   ├── admin.css             # Operations Console Styles
│   │   ├── script.js             # Client Interactive Logic
│   │   └── admin.js              # Administrator Dashboard Application
│   │
│   ├── public/
│   │   └── assets/               # Brand emblems, logos, and media assets
│   │
│   └── package.json              # Frontend workspace scripts
│
├── backend/
│   ├── routes/                   # Express API endpoints
│   │   ├── auth.js               # Admin authentication & MFA (TOTP)
│   │   ├── usersAuth.js          # Clinician/Client login, OTP verification & password reset
│   │   ├── admin.js              # Operational dispatch, facility rate cards, staff roster
│   │   ├── adminMail.js          # Outbound & inbound mail desk
│   │   ├── requests.js           # Client staffing order dispatch
│   │   ├── shifts.js             # Shift lifecycle, geofenced timecards & punch clocks
│   │   ├── applications.js       # ATS candidate intake & review
│   │   ├── contact.js            # General & facility inquiries
│   │   ├── documents.js          # Clinical compliance credential store
│   │   ├── newsletter.js         # Newsletter subscription management
│   │   └── emailWebhooks.js      # Inbound delivery webhook handlers
│   │
│   ├── models/                   # Structured data access models
│   │   ├── index.js              # Model registry export
│   │   ├── User.js               # User accounts & auth state
│   │   ├── Staff.js              # Clinician roster records
│   │   ├── Facility.js           # Healthcare facilities & rate agreements
│   │   └── Shift.js              # Clinical shifts & timecard punches
│   │
│   ├── middleware/               # Security, authentication & rate limiters
│   ├── services/                 # Mailer, worker queue & notification services
│   ├── utils/                    # Hardened cryptography, tokenizers & mail templates
│   ├── workers/                  # Background worker processes
│   ├── sql/                      # Relational schema and initial seeds
│   ├── private/                  # Authenticated admin dashboard views
│   ├── db.js                     # MySQL connection pool
│   ├── server.js                 # Primary Express server application
│   └── package.json              # Backend dependencies and execution scripts
│
└── README.md                     # Architecture and setup guide
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **MySQL**: Native MySQL server or Docker container (port 3306)

---

### Installation

Install dependencies from the project root:

```bash
npm install
```

---

### Running the Application

You can start the unified server (which serves the backend API and frontend assets):

```bash
# Start from root
npm start

# Or start directly from backend
cd backend
npm start
```

---

### Application URLs

- **Public Website:** [http://localhost:3000](http://localhost:3000)
- **Client & Clinician Sign In:** [http://localhost:3000/login.html](http://localhost:3000/login.html)
- **Admin Operations Console:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **System Health Check:** [http://localhost:3000/api/health](http://localhost:3000/api/health)
