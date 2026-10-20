# Pre-Launch Security Checklist (Pass/Fail)
**Divine Fingers Healthcare Services Inc.**
Complete every item before opening public traffic.

---

## 🔴 Gate 1: Priority 0 Mandatory Launch Blockers

| # | Item | Verification Command / Procedure | Status |
| :-: | :--- | :--- | :-: |
| 1 | **Source Code & Uploads Exposure Blocked** | `curl -I http://localhost:3000/server.js` and `curl -I http://localhost:3000/package.json` return **404**. Public pages return **200**. | [ ] PASS<br>[ ] FAIL |
| 2 | **Docker Port Exposure Neutralized** | `ss -tlnp` shows MySQL (3306) and Node (3000) listening on `127.0.0.1` **only**. No port bound to `0.0.0.0` except 22, 80, 443. | [ ] PASS<br>[ ] FAIL |
| 3 | **Hardcoded Default Passwords Eliminated** | No occurrences of `DivineFingers2026!` or auto-login logic in codebase. Password resets require verified email tokens. | [ ] PASS<br>[ ] FAIL |
| 4 | **In-Memory Database Backdoor Disabled** | In production, `db.js` fails closed immediately if MySQL disconnects. Seeded admin accounts removed from code. | [ ] PASS<br>[ ] FAIL |

---

## 🟠 Gate 2: Network, Server & Edge Perimeter

| # | Item | Verification Command / Procedure | Status |
| :-: | :--- | :--- | :-: |
| 5 | **SSH Hardened & Password Login Disabled** | `PermitRootLogin no`, `PasswordAuthentication no`, `MaxAuthTries 3` in `/etc/ssh/sshd_config`. | [ ] PASS<br>[ ] FAIL |
| 6 | **UFW & Fail2Ban Active** | `ufw status` shows `Status: active`. `fail2ban-client status` shows `sshd` and `nginx` jails. | [ ] PASS<br>[ ] FAIL |
| 7 | **Cloudflare SSL Full (Strict)** | Cloudflare SSL mode is **Full (strict)** with 15-year Origin Certificate installed in Nginx. | [ ] PASS<br>[ ] FAIL |
| 8 | **Origin Locked to Cloudflare IPs** | UFW or Nginx AOP rejects requests hitting the VPS IP directly. | [ ] PASS<br>[ ] FAIL |
| 9 | **Trust Proxy Configured** | `app.set('trust proxy', 1)` in place. `req.ip` reflects true visitor IP behind Cloudflare + Nginx. | [ ] PASS<br>[ ] FAIL |
| 10 | **CORS Whitelist Locked** | CORS rejects `null` origin and unrelated domains (`.vercel.app` removed). Only production domains allowed. | [ ] PASS<br>[ ] FAIL |

---

## 🟡 Gate 3: Application & Session Cryptography

| # | Item | Verification Command / Procedure | Status |
| :-: | :--- | :--- | :-: |
| 11 | **Separate Admin and User JWT Secrets** | `JWT_ADMIN_SECRET` and `JWT_USER_SECRET` are distinct, 32+ bytes random hex strings with no fallbacks. | [ ] PASS<br>[ ] FAIL |
| 12 | **Secure Cookie Flags Enforced** | `df_admin_session` and `df_user_session` have `httpOnly: true`, `secure: true`, `sameSite: 'Strict'`. | [ ] PASS<br>[ ] FAIL |
| 13 | **Session Invalidation on Reset** | Password reset increments `token_version` on user/admin row, invalidating all outstanding JWTs. | [ ] PASS<br>[ ] FAIL |
| 14 | **Double-Submit CSRF on Admin Endpoints** | State-changing admin routes enforce matching `df_csrf_token` cookie and `X-CSRF-Token` header. | [ ] PASS<br>[ ] FAIL |
| 15 | **Server-Side Turnstile & Honeypot** | Contact form silently drops bot submissions and validates Turnstile response server-side. | [ ] PASS<br>[ ] FAIL |

---

## 🟢 Gate 4: Email, Uploads & Communications

| # | Item | Verification Command / Procedure | Status |
| :-: | :--- | :--- | :-: |
| 16 | **Production SMTP Startup Guard** | App throws fatal exception and halts if `NODE_ENV=production` and SMTP host is localhost or credentials missing. | [ ] PASS<br>[ ] FAIL |
| 17 | **Transactional Outbox Active** | All route mail calls use `enqueueMail()`. Dedicated worker `app-mail-worker.service` processes queue. | [ ] PASS<br>[ ] FAIL |
| 18 | **Suppression List & Webhooks** | Bounces and complaints update `email_suppressions` via signature-verified webhook at `/api/webhooks/email`. | [ ] PASS<br>[ ] FAIL |
| 19 | **Zero PHI or Passwords in Email Bodies** | Email templates contain zero credentials or health details; use secure short-lived links. | [ ] PASS<br>[ ] FAIL |
| 20 | **MIME Magic-Byte Verification** | Uploads inspected by binary header; disguised files deleted immediately with 422 error. | [ ] PASS<br>[ ] FAIL |
| 21 | **Zip-Slip & Zip-Bomb Protections** | `safeExtractZip` rejects traversal entries (`..`) and caps archive entry count and decompression ratios. | [ ] PASS<br>[ ] FAIL |
| 22 | **Authenticated Document Delivery** | Resumes and credentials served only through `/api/documents/` with `Content-Disposition: attachment`. | [ ] PASS<br>[ ] FAIL |

---

## 🔵 Gate 5: Operations, Backups & Compliance

| # | Item | Verification Command / Procedure | Status |
| :-: | :--- | :--- | :-: |
| 23 | **Shift Lifecycle Singleton Lock** | `shiftLifecycleRunner.js` runs as separate service using MySQL `GET_LOCK` (no double execution). | [ ] PASS<br>[ ] FAIL |
| 24 | **Nightly Encrypted Backups** | `deploy/backup.sh` scheduled via cron; dumps and encrypts database and uploads to off-site storage. | [ ] PASS<br>[ ] FAIL |
| 25 | **Disaster Recovery Tested** | Backup restore procedure successfully executed on staging/test instance. | [ ] PASS<br>[ ] FAIL |
| 26 | **File Permissions Hardened** | `chmod 600 /var/www/divine-fingers/.env`, owner `app:app`. | [ ] PASS<br>[ ] FAIL |
| 27 | **Compliance Review (NDPA / HIPAA)** | Verify BAA and data processor agreements with Hostinger, Cloudflare, and relay provider with legal counsel. | [ ] PASS<br>[ ] FAIL |

---

### Sign-off & Launch Authorization

* **Lead Security Reviewer:** ______________________________
* **DevOps Lead:** ______________________________
* **Sign-Off Date:** _____ / _____ / 2026
