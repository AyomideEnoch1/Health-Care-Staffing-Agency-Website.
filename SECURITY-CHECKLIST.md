# Divine Fingers Healthcare Services — Security Checklist

## Instructions
Each item must be manually reviewed before any production deployment.
Mark [x] to confirm a control is in place. A checked box = deliberate confirmation, not assumption.

---

## 1. Authentication & Session Management

- [x] **JWT stored in httpOnly cookie** — not in localStorage or sessionStorage
- [x] **Cookie flags**: `httpOnly: true`, `Secure: true` (production only), `SameSite: Strict` (prod) / `Lax` (dev)
- [x] **JWT expiry**: 8 hours (configurable via `JWT_EXPIRES_IN`)
- [x] **No JWT in response body** — only CSRF token is returned at login
- [x] **Login lockout**: 15-minute account lock after 5 consecutive failures
- [x] **Logout clears both session cookie and CSRF cookie**
- [ ] **2FA (TOTP)**: `totp_secret` column reserved in admins table — implementation is a future milestone

---

## 2. CSRF Protection

- [x] **Double-submit cookie pattern** implemented — `df_csrf_token` cookie (JS-readable) must match `X-CSRF-Token` header on PATCH/POST admin routes
- [x] **Constant-time comparison** via `crypto.timingSafeEqual()` — prevents timing attacks
- [x] **CSRF not required on GET requests** (read-only, no state change)
- [x] **CSRF not required on public form routes** (`/api/requests`, `/api/applications`, `/api/contact`) — no session cookie involved

---

## 3. Input Validation & Injection Prevention

- [x] **Parameterized queries only** via `mysql2/promise` — no string concatenation anywhere in query construction
- [x] **Zod schema validation** on all form inputs before DB insert
- [x] **No dynamic SQL** built from user input

---

## 4. File Upload Security (Three-Layer Defence-in-Depth)

- [x] **Layer 1 — Extension whitelist**: `.pdf`, `.docx`, `.doc` checked by Multer `fileFilter`
- [x] **Layer 2 — Declared MIME whitelist**: `application/pdf`, `application/vnd.openxmlformats-...`, `application/msword` checked by Multer `fileFilter`
- [x] **Layer 3 — Content sniffing (magic bytes)**: `file-type` package reads actual file header after write; rejects mismatched content and deletes the file
- [x] **File stored outside webroot** — `uploads/resumes/` directory; no direct public URL access
- [x] **UUID-randomized filenames** — original filename never written to disk
- [x] **10MB size cap** — enforced by Multer limits
- [x] **Resume download protected** — only authenticated admins can retrieve files via `/api/admin/applications/:id/resume`

---

## 5. Password & Credential Security

- [x] **Bcrypt hashing** with cost factor 12 (slow by design — prevents brute force)
- [x] **No MD5, SHA1, or unsalted hashes** anywhere in codebase
- [x] **No plaintext passwords** in any committed file

---

## 6. Secrets & Configuration

- [x] **`.env` and `.env.local` gitignored** — confirmed in `.gitignore`
- [x] **No credentials hard-coded** in any `.js`, `.html`, or `.md` file committed to the repository
- [x] **`JWT_SECRET` must be cryptographically random** — minimum 64 characters. Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

---

## 7. Rate Limiting

- [x] **Public forms** (`/api/requests`, `/api/applications`, `/api/contact`): 10 requests / 15 minutes per IP
- [x] **Admin login** (`/api/auth/login`): 5 requests / 15 minutes per IP (additional account lockout layer)

---

## 8. Transport Security

- [x] **Helmet.js** applied — sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and other security headers
- [ ] **TLS/HTTPS enforcement** on Hostinger — must redirect HTTP → HTTPS via Let's Encrypt + Nginx/Apache
- [x] **CORS locked to known origins** — `ALLOWED_ORIGINS` env var; `.vercel.app` and `localhost` only in dev

---

## 9. Mock Data Audit (All items MUST be ✅ eliminated before production)

- [x] **KPI hardcoded numbers removed** from `admin.html` (`38`, `14`, `9`, `24`, `5`, `98.4%`) — replaced with live DB IDs
- [x] **Sidebar badge counts removed** — `48`, `14`, `9`, `3` badges replaced with `0` / `display:none` initialized by JS
- [x] **`renderCompliance()` fake CNO data eliminated** — now reads from real `staff_roster` rows with honest empty state
- [x] **`renderShiftScheduler()` fake facility grid eliminated** — now renders dispatched requests or empty state
- [x] **`renderChatInbox()` fake Sunnybrook conversation eliminated** — now renders real `contact_inquiries` or empty state
- [x] **`DivineFingersDB.exportCSV` fixed** — now exports from real `LiveStore` API data only (no mock fixtures)
- [x] **No hardcoded arrays of fake staff, requests, or applicants** remain in `admin.js`
- [x] **No hardcoded scheduler week** ("August 17–23, 2026") — removed from HTML
- [x] **Zero is a valid, honest state** — all 9 dashboard modules show honest empty-state UI when DB returns 0 rows

---

## 10. Required Corrections (from brief — all implemented)

- [x] **No "PHIPA/PIPEDA compliance" claim** — all documentation uses "technical safeguards aligned with PHIPA/PIPEDA principles" with explicit note that legal/privacy review is separate
- [x] **JWT in httpOnly cookie** — not returned in response body for localStorage storage
- [x] **CSRF protection added** — double-submit cookie pattern on all state-changing admin routes
- [x] **Resume content sniffing** — `file-type` package verifies magic bytes, not just declared MIME
- [x] **IP address retention note** — documented as 90-day recommended maximum; configurable via `IP_RETENTION_DAYS` env var; purge job flagged as separate operational requirement

---

## 11. Admin Portal Discoverability

- [x] **`admin.html` not linked from any public page** — removed from all 7 public page footers/navs
- [x] **No `sitemap.xml` or `robots.txt` reference** to admin routes (verify before deployment)
- [ ] **Rate-limit the admin HTML route** on Nginx (e.g., `location /admin.html { allow <office-IP>; deny all; }`) — recommended for production

---

## 12. Privacy & Legal (Requires Separate Non-Technical Review)

> [!CAUTION]
> The following are NOT covered by this technical build. They require separate legal/privacy review by a qualified professional before going live.

- [ ] **Data retention policy** — define how long staffing requests, applications, and audit logs are kept
- [ ] **IP address purge schedule** — automated purge of `ip_address` columns older than 90 days (or chosen retention window)
- [ ] **Breach notification procedure** — documented process under PIPEDA's 72-hour notification requirement
- [ ] **Privacy officer designation** — Ontario-based organizations serving health facilities should designate a privacy officer
- [ ] **Candidate data deletion on request** — mechanism for candidates to request removal of their application and resume
- [ ] **Consent language** on public forms — ensure form language satisfies PIPEDA collection consent requirements
