"""
Divine Fingers Healthcare Services Inc.
Architecture & Technical Schema — PDF Generator
Uses ReportLab (pure Python, no external native libs needed)
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import HRFlowable
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.pdfbase import pdfmetrics

OUTPUT = r"C:\Users\Ayomide Enoch\Downloads\Divine_Fingers_Healthcare_Architecture_and_Schema.pdf"

# ── Colour Palette ──────────────────────────────────────────────────────────
TEAL        = colors.HexColor('#00a896')
NAVY        = colors.HexColor('#0b192c')
LIGHT_TEAL  = colors.HexColor('#e6fffa')
LIGHT_GREY  = colors.HexColor('#f8fafc')
MID_GREY    = colors.HexColor('#e2e8f0')
TEXT_DARK   = colors.HexColor('#0f172a')
TEXT_MID    = colors.HexColor('#334155')
TEXT_MUTED  = colors.HexColor('#64748b')
GOLD        = colors.HexColor('#b7791f')
GOLD_BG     = colors.HexColor('#fefcbf')
BLUE_BG     = colors.HexColor('#ebf8ff')
BLUE_FG     = colors.HexColor('#2b6cb0')
GREEN_BG    = colors.HexColor('#f0fff4')
GREEN_FG    = colors.HexColor('#276749')

# ── Document ─────────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=16*mm, rightMargin=16*mm,
    topMargin=18*mm, bottomMargin=18*mm,
    title="Divine Fingers Healthcare – Architecture & Schema",
    author="Divine Fingers Healthcare Services Inc.",
)

W = A4[0] - 32*mm   # usable width

# ── Styles ───────────────────────────────────────────────────────────────────
base = getSampleStyleSheet()

def S(name, parent='Normal', **kwargs):
    return ParagraphStyle(name, parent=base[parent], **kwargs)

sTitle   = S('DocTitle',   fontSize=18, textColor=NAVY,  fontName='Helvetica-Bold',  spaceAfter=2, leading=22)
sSubtitle= S('DocSub',     fontSize=9,  textColor=TEAL,  fontName='Helvetica-Bold',  spaceAfter=0)
sMeta    = S('Meta',       fontSize=8,  textColor=TEXT_MUTED, fontName='Helvetica', alignment=TA_RIGHT)
sH1      = S('H1',         fontSize=13, textColor=NAVY,  fontName='Helvetica-Bold',  spaceBefore=14, spaceAfter=6, leading=17)
sH2      = S('H2',         fontSize=11, textColor=TEAL,  fontName='Helvetica-Bold',  spaceBefore=10, spaceAfter=4, leading=15)
sH3      = S('H3',         fontSize=9.5,textColor=TEXT_DARK, fontName='Helvetica-Bold', spaceBefore=8, spaceAfter=3)
sBody    = S('Body',       fontSize=8.5,textColor=TEXT_MID, fontName='Helvetica',    spaceAfter=5, leading=13)
sCallout = S('Callout',    fontSize=8.5,textColor=TEXT_DARK,fontName='Helvetica',    spaceAfter=4, leading=13, leftIndent=10)
sCode    = S('Code',       fontSize=7.5,textColor=NAVY,  fontName='Courier-Bold')
sCell    = S('Cell',       fontSize=7.5,textColor=TEXT_MID, fontName='Helvetica',    leading=11)
sCellH   = S('CellH',      fontSize=7.5,textColor=TEXT_DARK,fontName='Helvetica-Bold',leading=11)
sCellCode= S('CellCode',   fontSize=7,  textColor=NAVY,  fontName='Courier',         leading=10)
sFooter  = S('Footer',     fontSize=7,  textColor=TEXT_MUTED, fontName='Helvetica', alignment=TA_CENTER)

def tbl_style(header_bg=LIGHT_GREY, row_alt=None):
    cmds = [
        ('BACKGROUND',  (0,0), (-1,0), header_bg),
        ('TEXTCOLOR',   (0,0), (-1,0), TEXT_DARK),
        ('FONTNAME',    (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',    (0,0), (-1,-1), 7.5),
        ('FONTNAME',    (0,1), (-1,-1), 'Helvetica'),
        ('TEXTCOLOR',   (0,1), (-1,-1), TEXT_MID),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#fcfcfc')]),
        ('GRID',        (0,0), (-1,-1), 0.4, MID_GREY),
        ('VALIGN',      (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING',  (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0),(-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING',(0,0), (-1,-1), 6),
    ]
    return TableStyle(cmds)

def p(text, style=sBody): return Paragraph(text, style)
def code(text):            return Paragraph(text, sCellCode)
def sp(h=4):               return Spacer(1, h*mm)
def hr():                  return HRFlowable(width="100%", thickness=0.5, color=MID_GREY, spaceAfter=4, spaceBefore=4)

def callout(title, body):
    return Table(
        [[p(f'<b><font color="#00a896">{title}</font></b><br/>{body}', sCallout)]],
        colWidths=[W],
        style=TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), LIGHT_TEAL),
            ('LEFTPADDING',(0,0),(-1,-1), 12),
            ('RIGHTPADDING',(0,0),(-1,-1),12),
            ('TOPPADDING', (0,0),(-1,-1), 8),
            ('BOTTOMPADDING',(0,0),(-1,-1), 8),
            ('LINEAFTER',  (0,0),(0,-1), 4, TEAL),
            ('ROUNDEDCORNERS', [4]),
        ])
    )

def badge(text, bg, fg):
    return Table([[p(f'<b>{text}</b>', ParagraphStyle('b', fontSize=7, textColor=fg, fontName='Helvetica-Bold'))]],
        colWidths=[None],
        style=TableStyle([
            ('BACKGROUND',(0,0),(-1,-1), bg),
            ('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4),
            ('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2),
        ])
    )

# ── Header ───────────────────────────────────────────────────────────────────
header_data = [[
    [p('Divine Fingers Healthcare Services Inc.', sTitle),
     p('SYSTEM ARCHITECTURE &amp; DATABASE TECHNICAL BLUEPRINT', sSubtitle)],
    [p('Corporation ID: 1592082-5<br/>Version: 2.0 (Node.js + MySQL)<br/>Date: August 31, 2026<br/>Status: <b>Production-Ready</b>', sMeta)]
]]
header_tbl = Table(header_data, colWidths=[W*0.65, W*0.35])
header_tbl.setStyle(TableStyle([
    ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ('LINEBELOW',(0,0),(-1,-1),1.5, TEAL),
    ('TOPPADDING',(0,0),(-1,-1),0),
    ('BOTTOMPADDING',(0,0),(-1,-1),8),
]))

# ── Content builder ───────────────────────────────────────────────────────────
story = []

story.append(header_tbl)
story.append(sp(4))

story.append(callout(
    'Executive Summary',
    'This document provides the complete architectural schema and engineering blueprint for Divine Fingers Healthcare Services Inc. '
    'The platform was migrated from a broken client-side localStorage prototype to a production-grade '
    '<b>Node.js (Express) + MySQL 8.0</b> backend, achieving full PHIPA/PIPEDA compliance. '
    'Key features include real-time dispatch via Server-Sent Events (SSE), role-based JWT authentication, '
    'rate limiting, and secure candidate resume handling.'
))
story.append(sp(4))

# ── 1. SYSTEM ARCHITECTURE ────────────────────────────────────────────────────
story.append(p('1. High-Level Architecture &amp; Deployment Topology', sH1))
story.append(hr())

arch_data = [
    [p('<b>Layer</b>', sCellH), p('<b>Technology Stack</b>', sCellH), p('<b>Hosting / Runtime</b>', sCellH), p('<b>Responsibilities</b>', sCellH)],
    [p('Frontend (Client)', sCell), p('HTML5, CSS3 (Custom Properties),<br/>Vanilla JS, GSAP ScrollTrigger', sCell), p('Vercel Edge CDN<br/>(Global)', sCell), p('Page delivery, form submission, SSE listener, resume upload, admin dashboard UI', sCell)],
    [p('API Server', sCell), p('Node.js 22 LTS, Express.js,<br/>Helmet, CORS, Multer, Zod', sCell), p('Hostinger VPS<br/>Port 3000', sCell), p('Input validation, authentication, file handling, email dispatch, real-time event broadcasting', sCell)],
    [p('Database', sCell), p('MySQL 8.0+ (InnoDB)<br/>utf8mb4_unicode_ci', sCell), p('Hostinger MySQL<br/>Port 3306', sCell), p('Persistent storage of staffing requests, candidate applications, staff roster, contacts, audit logs', sCell)],
    [p('File Storage', sCell), p('Protected Disk (chmod 700)<br/>UUID-obfuscated filenames', sCell), p('Hostinger Server<br/>Outside webroot', sCell), p('Secure storage of candidate PDF/DOCX resumes, inaccessible via public URL', sCell)],
    [p('Email', sCell), p('Nodemailer + SMTP<br/>(Hostinger / MailHog dev)', sCell), p('Hostinger SMTP<br/>Port 587/465', sCell), p('Facility shift alerts, candidate submission confirmations, admin login notifications', sCell)],
]
t = Table(arch_data, colWidths=[W*0.16, W*0.24, W*0.18, W*0.42])
t.setStyle(tbl_style())
story.append(t)
story.append(sp(4))

# ── 2. FRONTEND PAGES ────────────────────────────────────────────────────────
story.append(p('2. Frontend Architecture &amp; Page Specifications', sH1))
story.append(hr())
story.append(p('The frontend is a high-performance <b>Multi-Page Application (MPA)</b> using semantic HTML5, CSS3 design system tokens, and GSAP animation engine. All form submissions are routed asynchronously to the Node.js REST API.', sBody))
story.append(sp(2))

pages_data = [
    [p('<b>Page</b>', sCellH), p('<b>Audience</b>', sCellH), p('<b>Key Components</b>', sCellH), p('<b>API Endpoint</b>', sCellH)],
    [code('index.html'),     p('Public / All Visitors', sCell), p('Hero carousel, role pagination, service highlights, quick inquiry', sCell), code('POST /api/contact')],
    [code('about.html'),     p('Corporates / Partners', sCell), p('Executive leadership bios, Corp ID 1592082-5, mission &amp; values', sCell), p('Static', sCell)],
    [code('services.html'),  p('Healthcare Facilities', sCell), p('Deep-dive service cards: RN, RPN, PSW, Travel Nursing, Companions', sCell), p('Static', sCell)],
    [code('clients.html'),   p('Hospitals, LTCs, Clinics', sCell), p('Staffing Request Form — facility, role, shift type, urgency level', sCell), code('POST /api/requests')],
    [code('jobseekers.html'),p('Nurses, PSWs, RPNs', sCell), p('Candidate Portal with PDF/DOCX resume upload (multipart FormData)', sCell), code('POST /api/applications')],
    [code('blog.html'),      p('Clinical Professionals', sCell), p('Continuing education, LTC compliance guides, regulatory updates', sCell), p('Static', sCell)],
    [code('contact.html'),   p('General Public', sCell), p('24/7 Care Coordination desk, Scarborough office address &amp; map', sCell), code('POST /api/contact')],
    [code('admin.html'),     p('Agency Coordinators', sCell), p('9-module real-time Operations Dashboard (SSE-powered)', sCell), code('/api/admin/* + /api/auth/*')],
]
t = Table(pages_data, colWidths=[W*0.18, W*0.18, W*0.42, W*0.22])
t.setStyle(tbl_style())
story.append(t)
story.append(sp(4))

story.append(p('2.1 Admin Operations Dashboard — 9 Modules', sH2))
admin_data = [
    [p('<b>Module</b>', sCellH), p('<b>Tab ID</b>', sCellH), p('<b>Capabilities</b>', sCellH)],
    [p('Dashboard Overview', sCell),  code('#overview-tab'),    p('6 Live KPI metric cards, shift fulfillment area chart, role donut chart, operational activity feed', sCell)],
    [p('Staff Roster', sCell),         code('#roster-tab'),      p('Active caregiver table with CNO badges, ratings, hourly billing rates, and slide-over profile drawer', sCell)],
    [p('Client Requests', sCell),      code('#requests-tab'),    p('Real-time Kanban board &amp; Data Table; 1-click dispatch transitions: Pending → Dispatched → Completed', sCell)],
    [p('Job Applications (ATS)', sCell),code('#applicants-tab'), p('Pipeline stage tracking (new/review/interview/hired/rejected) with authenticated resume downloads', sCell)],
    [p('Shift Scheduler', sCell),      code('#scheduler-tab'),   p('Weekly coverage matrix across GTA hospitals: Sunnybrook, Humber River, Chartwell, Scarborough Health', sCell)],
    [p('Live Dispatch Inbox', sCell),  code('#messages-tab'),    p('Direct facility-coordinator communication channel with dispatch instruction send/receive', sCell)],
    [p('Compliance &amp; Docs', sCell),code('#compliance-tab'),  p('CNO licensure, VSS Police Checks, N95 fit tests, CPR/BLS expiry matrix for all rostered staff', sCell)],
    [p('Reports &amp; Export', sCell), code('#reports-tab'),     p('One-click CSV export for shift fill rates, staff roster, and ATS pipeline data', sCell)],
    [p('Settings &amp; Audit', sCell), code('#settings-tab'),    p('Immutable audit log: all logins, status changes, and dispatch actions with operator IP &amp; timestamps', sCell)],
]
t = Table(admin_data, colWidths=[W*0.22, W*0.18, W*0.60])
t.setStyle(tbl_style())
story.append(t)
story.append(sp(4))

# ── 3. BACKEND API ────────────────────────────────────────────────────────────
story.append(PageBreak())
story.append(p('3. Backend Architecture &amp; REST API Endpoints', sH1))
story.append(hr())
story.append(p('The Express.js server orchestrates security middleware, business logic, real-time broadcasting, and database persistence:', sBody))

# File tree
filetree = """
 project-root/
 ├── server.js               ← Application bootstrap, Helmet, CORS, body parsers, route mounting
 ├── db.js                   ← mysql2/promise connection pool + health check
 ├── schema.sql              ← 3NF relational schema (6 tables, InnoDB, utf8mb4)
 ├── utils/
 │   ├── mailer.js           ← Nodemailer SMTP dispatcher (alerts + confirmations)
 │   └── events.js           ← EventEmitter hub powering real-time SSE stream
 ├── middleware/
 │   ├── auth.js             ← JWT Bearer token auth + RBAC role enforcement
 │   ├── rateLimiter.js      ← 10 req/15 min (forms); 5 req/15 min (login)
 │   ├── upload.js           ← Multer: MIME check, extension check, UUID renaming, 10MB cap
 │   └── errorHandler.js     ← Centralized error handler with PII scrubbing
 └── routes/
     ├── requests.js         ← POST /api/requests
     ├── applications.js     ← POST /api/applications (multipart)
     ├── contact.js          ← POST /api/contact
     ├── auth.js             ← POST /api/auth/login
     └── admin.js            ← GET/PATCH /api/admin/* (SSE stream + CRUD)
"""
story.append(Table(
    [[p(filetree.replace('\n','<br/>').replace(' ','&nbsp;'), ParagraphStyle('ft', fontName='Courier', fontSize=7, textColor=colors.HexColor('#e2e8f0'), leading=11))]],
    colWidths=[W],
    style=TableStyle([
        ('BACKGROUND',(0,0),(-1,-1), NAVY),
        ('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10),
        ('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),
    ])
))
story.append(sp(4))

story.append(p('3.1 REST API Endpoint Reference', sH2))
api_data = [
    [p('<b>Method</b>',sCellH), p('<b>Endpoint</b>',sCellH), p('<b>Auth</b>',sCellH), p('<b>Description</b>',sCellH)],
    [p('POST', sCell), code('/api/requests'),                        p('Public + Rate Limit', sCell), p('Zod-validated facility shift order. Inserts into staffing_requests, sends email alert, emits SSE event.', sCell)],
    [p('POST', sCell), code('/api/applications'),                    p('Public + Rate Limit', sCell), p('Multipart resume upload. Enforces PDF/DOCX MIME &amp; 10MB cap. UUID rename. DB insert + confirmation email.', sCell)],
    [p('POST', sCell), code('/api/contact'),                         p('Public + Rate Limit', sCell), p('General inquiry from contact.html and index.html. Writes to contact_inquiries.', sCell)],
    [p('POST', sCell), code('/api/auth/login'),                      p('Public + Strict Limit', sCell), p('Bcrypt compare. 5-attempt lockout → 15-min ban. Issues signed JWT (8h expiry) on success.', sCell)],
    [p('GET',  sCell), code('/api/admin/stream'),                    p('JWT Required', sCell), p('Server-Sent Events (SSE) stream. Broadcasts live submissions and status changes to connected admins.', sCell)],
    [p('GET',  sCell), code('/api/admin/requests'),                  p('JWT Required', sCell), p('Returns all staffing requests with joined assigned staff name, sorted by recency.', sCell)],
    [p('PATCH',sCell), code('/api/admin/requests/:id/status'),       p('JWT Required', sCell), p('Updates request status and staff assignment. Writes immutable record to audit_logs table.', sCell)],
    [p('GET',  sCell), code('/api/admin/applications'),              p('JWT Required', sCell), p('Fetches full ATS candidate pipeline with stage, resume metadata, and contact info.', sCell)],
    [p('PATCH',sCell), code('/api/admin/applications/:id/stage'),    p('JWT Required', sCell), p('Updates candidate ATS stage (new/review/interview/hired/rejected).', sCell)],
    [p('GET',  sCell), code('/api/admin/applications/:id/resume'),   p('JWT Required', sCell), p('Securely streams candidate resume from protected disk storage to the authenticated admin.', sCell)],
    [p('GET',  sCell), code('/api/admin/roster'),                    p('JWT Required', sCell), p('Returns active RN, RPN, and PSW staff from staff_roster table.', sCell)],
    [p('GET',  sCell), code('/api/admin/audit-logs'),                p('JWT Required', sCell), p('Returns last 100 immutable audit log records.', sCell)],
    [p('GET',  sCell), code('/api/health'),                          p('Public', sCell), p('System liveness healthcheck endpoint.', sCell)],
]
t = Table(api_data, colWidths=[W*0.09, W*0.31, W*0.18, W*0.42])
t.setStyle(tbl_style())
story.append(t)
story.append(sp(4))

# ── 4. DATABASE SCHEMA ────────────────────────────────────────────────────────
story.append(PageBreak())
story.append(p('4. Database Relational Schema (MySQL 3NF Normalized)', sH1))
story.append(hr())
story.append(p('Database: <b>divine_fingers_dev</b> | Engine: InnoDB | Charset: utf8mb4_unicode_ci | All IDs: UUID v4 (VARCHAR 36)', sBody))
story.append(sp(2))

def schema_table(title, headers, rows):
    data = [[ p(h, sCellH) for h in headers ]]
    for r in rows:
        data.append([p(r[0], sCellCode)] + [p(c, sCell) for c in r[1:]])
    t = Table(data)
    t.setStyle(tbl_style())
    return KeepTogether([p(title, sH3), t, sp(3)])

story.append(schema_table(
    'Table 1: admins — Administrative Accounts &amp; Role-Based Access Control',
    ['Column', 'Type', 'Constraint', 'Purpose'],
    [
        ('id',                    'VARCHAR(36)',    'PRIMARY KEY',         'UUID v4 identifier'),
        ('email',                 'VARCHAR(191)',   'UNIQUE, NOT NULL',    'Administrator login username'),
        ('password_hash',         'VARCHAR(255)',   'NOT NULL',            'Bcrypt hash (cost factor 12)'),
        ('full_name',             'VARCHAR(100)',   'NOT NULL',            'Legal name for audit log attribution'),
        ('role',                  'ENUM',           'NOT NULL',            'super-admin | dispatch | care-coordinator'),
        ('failed_login_attempts', 'INT UNSIGNED',   'DEFAULT 0',           'Brute-force attempt counter'),
        ('lock_until',            'DATETIME',       'NULL',                '15-min lockout timestamp after 5 failures'),
        ('totp_secret',           'VARCHAR(128)',   'NULL',                'Reserved for future 2FA (TOTP)'),
        ('is_active',             'TINYINT(1)',     'DEFAULT 1',           'Immediately deactivate former staff'),
        ('created_at',            'TIMESTAMP',      'CURRENT_TIMESTAMP',   'Record creation audit timestamp'),
    ]
))

story.append(schema_table(
    'Table 2: staffing_requests — Facility Shift Orders',
    ['Column', 'Type', 'Constraint', 'Purpose'],
    [
        ('id',                  'VARCHAR(36)',  'PRIMARY KEY',           'UUID v4'),
        ('request_code',        'VARCHAR(20)',  'UNIQUE, NOT NULL',      'Human-readable ref (e.g. REQ-482)'),
        ('facility_name',       'VARCHAR(150)', 'NOT NULL',              'Hospital or Long-Term Care name'),
        ('unit_department',     'VARCHAR(100)', 'NULL',                  'Clinical unit (ICU, Emergency, Memory Care)'),
        ('contact_name',        'VARCHAR(100)', 'NOT NULL',              'Charge nurse or staffing coordinator'),
        ('contact_email',       'VARCHAR(191)', 'NOT NULL',              'Facility official work email'),
        ('contact_phone',       'VARCHAR(30)',  'NOT NULL',              'Direct dispatch phone'),
        ('role_requested',      'ENUM',         'NOT NULL',              'RN | RPN | PSW | Companion | Travel Nurse | Multiple'),
        ('shift_type',          'VARCHAR(60)',  'NOT NULL',              'Day, Night, Weekend, or 24/7 Surge'),
        ('urgency_level',       'ENUM',         "DEFAULT 'routine'",     'routine | urgent | emergency_surge'),
        ('status',              'ENUM',         "DEFAULT 'pending'",     'pending | dispatched | completed | cancelled'),
        ('assigned_staff_id',   'VARCHAR(36)',  'FK → staff_roster.id',  'Linked dispatched nurse (ON DELETE SET NULL)'),
        ('special_instructions','TEXT',         'NULL',                  'Patient acuity or unit-specific requirements'),
        ('ip_address',          'VARCHAR(45)',  'NULL',                  'Originating client IP for audit integrity'),
    ]
))

story.append(schema_table(
    'Table 3: job_applications — Candidate Submissions &amp; ATS Pipeline',
    ['Column', 'Type', 'Constraint', 'Purpose'],
    [
        ('id',                    'VARCHAR(36)',  'PRIMARY KEY',      'UUID v4'),
        ('application_code',      'VARCHAR(20)',  'UNIQUE, NOT NULL', 'Human-readable ref (e.g. APP-710)'),
        ('full_name',             'VARCHAR(120)', 'NOT NULL',         'Candidate legal name'),
        ('role_applied',          'ENUM',         'NOT NULL',         'RN | RPN | PSW | Companion | Travel Nurse'),
        ('email',                 'VARCHAR(191)', 'NOT NULL',         'Candidate contact email'),
        ('phone',                 'VARCHAR(30)',  'NOT NULL',         'Candidate mobile phone'),
        ('license_registration',  'VARCHAR(80)',  'NOT NULL',         'CNO Registration # or PSW Certificate ID'),
        ('stage',                 'ENUM',         "DEFAULT 'new'",    'new | review | interview | hired | rejected'),
        ('resume_original_name',  'VARCHAR(255)', 'NOT NULL',         'Original upload filename (e.g. Sarah_CV.pdf)'),
        ('resume_stored_name',    'VARCHAR(255)', 'NOT NULL',         'UUID-randomized on-disk filename'),
        ('resume_mime_type',      'VARCHAR(100)', 'NOT NULL',         'Verified MIME (application/pdf, application/docx)'),
        ('resume_file_size',      'INT UNSIGNED', 'NOT NULL',         'File size in bytes (max 10 MB enforced)'),
        ('resume_storage_path',   'VARCHAR(255)', 'NOT NULL',         'Absolute path on server outside webroot'),
        ('ip_address',            'VARCHAR(45)',  'NULL',             'Submission IP for spam/audit tracking'),
    ]
))

story.append(schema_table(
    'Table 4: staff_roster — Agency Clinical Personnel',
    ['Column', 'Type', 'Constraint', 'Purpose'],
    [
        ('id',                  'VARCHAR(36)',   'PRIMARY KEY',     'UUID v4'),
        ('staff_code',          'VARCHAR(20)',   'UNIQUE',          'Roster identifier (e.g. STF-101)'),
        ('name',                'VARCHAR(120)',  'NOT NULL',        'Healthcare professional full name'),
        ('role',                'ENUM',          'NOT NULL',        'RN | RPN | PSW | Companion | Travel Nurse'),
        ('specialty',           'VARCHAR(120)',  'NOT NULL',        'ICU, Cardiology, Geriatric, Dementia, etc.'),
        ('cno_registration_num','VARCHAR(50)',   'NULL',            'College of Nurses of Ontario Registration ID'),
        ('status',              'ENUM',          "DEFAULT 'available'", 'available | on-shift | off-duty | suspended'),
        ('credential_status',   'ENUM',          "DEFAULT 'verified'",  'verified | expiring | expired'),
        ('rating',              'DECIMAL(3,2)',  'DEFAULT 5.00',    'Facility feedback score (1.00–5.00)'),
        ('shifts_completed',    'INT UNSIGNED',  'DEFAULT 0',       'Total shifts successfully filled'),
        ('region',              'VARCHAR(80)',   'NOT NULL',        'Assigned GTA Region (Scarborough, Peel, etc.)'),
        ('hourly_rate',         'DECIMAL(6,2)', 'NOT NULL',         'Hourly pay rate in CAD'),
        ('cpr_expiry_date',     'DATE',          'NOT NULL',        'Heart &amp; Stroke BLS/CPR expiry date'),
        ('vss_status',          'VARCHAR(60)',   "DEFAULT 'Clear'", 'Ontario Police Vulnerable Sector Screening'),
        ('n95_fit_test',        'VARCHAR(60)',   "DEFAULT '3M Valid'", 'N95 Mask Fit Test certification status'),
    ]
))

story.append(schema_table(
    'Table 5: contact_inquiries — Public Website Inquiries',
    ['Column', 'Type', 'Constraint', 'Purpose'],
    [
        ('id',           'VARCHAR(36)',  'PRIMARY KEY',      'UUID v4'),
        ('inquiry_code', 'VARCHAR(20)',  'UNIQUE, NOT NULL', 'Human-readable ref (e.g. INQ-203)'),
        ('name',         'VARCHAR(100)', 'NOT NULL',         'Submitter full name'),
        ('email',        'VARCHAR(191)', 'NOT NULL',         'Contact email address'),
        ('phone',        'VARCHAR(30)',  'NULL',             'Optional phone number'),
        ('inquiry_type', 'VARCHAR(80)',  'NOT NULL',         'General, Partnership, Career, Urgent, Media'),
        ('message',      'TEXT',         'NOT NULL',         'Inquiry body text'),
        ('status',       'ENUM',         "DEFAULT 'unread'", 'unread | read | responded | archived'),
        ('ip_address',   'VARCHAR(45)',  'NULL',             'Submitter IP for audit'),
        ('created_at',   'TIMESTAMP',    'CURRENT_TIMESTAMP','Submission timestamp'),
    ]
))

story.append(schema_table(
    'Table 6: audit_logs — Immutable Security &amp; Compliance Ledger',
    ['Column', 'Type', 'Constraint', 'Purpose'],
    [
        ('id',            'VARCHAR(36)',  'PRIMARY KEY',   'UUID v4'),
        ('admin_id',      'VARCHAR(36)',  'FK → admins.id','Operator who performed the action'),
        ('actor_name',    'VARCHAR(100)', 'NOT NULL',      'Human-readable operator display name'),
        ('action',        'VARCHAR(60)',  'NOT NULL',      'Event type (e.g. LOGIN_SUCCESS, STATUS_CHANGED)'),
        ('target_entity', 'VARCHAR(60)',  'NOT NULL',      'Affected module (staffing_requests, admins, etc.)'),
        ('target_id',     'VARCHAR(36)',  'NULL',          'UUID of the affected record'),
        ('details',       'TEXT',         'NULL',          'Human-readable event description'),
        ('severity',      'ENUM',         "DEFAULT 'info'", 'info | warning | critical'),
        ('ip_address',    'VARCHAR(45)',  'NULL',          'Operator source IP address'),
        ('created_at',    'TIMESTAMP',    'CURRENT_TIMESTAMP', 'Immutable event timestamp (EST)'),
    ]
))

# ── 5. SECURITY MATRIX ────────────────────────────────────────────────────────
story.append(p('5. Security, Privacy &amp; Canadian Compliance Matrix', sH1))
story.append(hr())

sec_data = [
    [p('<b>Dimension</b>',sCellH), p('<b>Implementation</b>',sCellH), p('<b>Standard / Regulation</b>',sCellH)],
    [p('Data In Transit',sCell),      p('TLS 1.3 / HTTPS with mandatory 301 redirect. CORS locked to divinefingershealthcare.ca.',sCell), p('PIPEDA Schedule 1, Principle 7',sCell)],
    [p('Password Security',sCell),    p('Bcrypt hashing with cost factor 12. 15-minute lockout after 5 failed login attempts.',sCell), p('NIST SP 800-63B Authentication',sCell)],
    [p('Nurse PII &amp; CV Storage',sCell), p('Stored outside webroot with chmod 700. UUID-obfuscated filenames. No public URL.',sCell), p('PHIPA (Personal Health Information Protection Act)',sCell)],
    [p('SQL Injection Prevention',sCell), p('100% parameterized queries via mysql2/promise. Zero SQL string concatenations anywhere.',sCell), p('OWASP Top 10 — A03: Injection',sCell)],
    [p('Authorization',sCell),        p('JWT Bearer tokens (HMAC-SHA256, 8h expiry). Role-based access: super-admin, dispatch, care-coordinator.',sCell), p('OWASP Top 10 — A01: Broken Access Control',sCell)],
    [p('File Upload Security',sCell), p('Strict MIME type + extension whitelist (.pdf, .docx, .doc). 10 MB size cap. UUID rename.',sCell), p('OWASP Top 10 — A04: Insecure Design',sCell)],
    [p('Denial of Service',sCell),    p('express-rate-limit: 10 submissions/15 min (public forms), 5 attempts/15 min (admin login).',sCell), p('OWASP Top 10 — A05: Security Misconfiguration',sCell)],
    [p('Audit Trail',sCell),          p('Immutable audit_logs table: operator name, IP, action, target record, severity, timestamp.',sCell), p('CNO Regulatory Records, PHIPA Accountability',sCell)],
]
t = Table(sec_data, colWidths=[W*0.20, W*0.48, W*0.32])
t.setStyle(tbl_style())
story.append(t)
story.append(sp(6))

# ── FOOTER ────────────────────────────────────────────────────────────────────
story.append(HRFlowable(width="100%", thickness=0.5, color=MID_GREY, spaceAfter=4))
story.append(p(
    'Divine Fingers Healthcare Services Inc. (Corp ID: 1592082-5) &nbsp;|&nbsp; '
    'CONFIDENTIAL — ENGINEERING SPECIFICATION &nbsp;|&nbsp; '
    'Scarborough, Ontario, Canada &nbsp;|&nbsp; August 2026',
    sFooter
))

# ── Build PDF ─────────────────────────────────────────────────────────────────
try:
    doc.build(story)
    size = os.path.getsize(OUTPUT)
    print(f"SUCCESS: PDF saved to:\n{OUTPUT}\nFile size: {size:,} bytes")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"ERROR: {e}")
