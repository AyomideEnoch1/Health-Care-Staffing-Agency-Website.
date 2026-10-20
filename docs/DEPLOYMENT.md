# Production Deployment Runbook — Hostinger KVM VPS
**Divine Fingers Healthcare Services Inc.**
Ubuntu 22.04 / 24.04 LTS &bull; Cloudflare Edge &bull; Nginx Reverse Proxy &bull; Node.js Systemd Daemons

---

## Architecture Overview

```
                      INTERNET
                         │
                         ▼
             [Cloudflare Edge Network]
             - WAF Rules & Bot Fight Mode
             - Turnstile Verification
             - SSL Full (Strict) + Edge Rate Limiting
                         │
                         ▼ (Cloudflare Authenticated IPs only: 80, 443)
                 [Hostinger VPS]
              ┌─────────────────────┐
              │ UFW / Fail2Ban      │
              │ Nginx (TLS 1.2/1.3) │
              └──────────┬──────────┘
                         │ Proxy: 127.0.0.1:3000
                         ▼
        ┌───────────────────────────────────┐
        │     Node.js Application Cluster    │
        │ - app-web.service                 │
        │ - app-mail-worker.service         │
        │ - app-shift-lifecycle.service     │
        └──────────┬──────────────┬─────────┘
                   │              │
                   ▼              ▼
     [MySQL 8.0 (127.0.0.1)]  [Hostinger SMTP Relay]
     - Least-privilege user   - TLS 1.2+ STARTTLS
     - local-infile=0         - Outbox queue & suppression
```

---

## Phase 1: VPS Provisioning & Host Hardening

### 1.1 Connect & Snapshot
1. In Hostinger hPanel, order or select an **Ubuntu 22.04 or 24.04 LTS KVM VPS**.
2. Create an initial VPS snapshot in hPanel before applying changes.
3. SSH into the server as root:
   ```bash
   ssh root@<YOUR_VPS_IP>
   ```

### 1.2 Clone Repository & Run Automated Hardening Engine
```bash
git clone https://github.com/your-org/divine-fingers-backend.git /var/www/divine-fingers
cd /var/www/divine-fingers
chmod +x deploy/harden.sh deploy/backup.sh deploy/nginx/update-cloudflare-ips.sh

# Run the idempotent hardening script
bash deploy/harden.sh
```
*The script creates the unprivileged `app` user, installs Fail2Ban, configures UFW firewall, hardens SSH (key-only authentication, `PermitRootLogin no`), and enables unattended security upgrades.*

### 1.3 Fix File Ownership & Permissions
```bash
chown -R app:app /var/www/divine-fingers
chmod 700 /var/www/divine-fingers/uploads
```

---

## Phase 2: Cloudflare & Edge DNS Setup

Refer to the detailed [Cloudflare Setup Guide](file:///docs/cloudflare-setup.md) for full instructions:
1. **Authoritative DNS:**
   * Point `@` (A record) to `<YOUR_VPS_IP>` (Proxied / Orange Cloud).
   * Point `www` (CNAME record) to `divinefingershealthcare.ca` (Proxied).
   * Point `notify` (A record) to `<YOUR_VPS_IP>` (Proxied).
2. **Edge SSL Mode:** Set to **Full (strict)**.
3. **Generate Origin Certificate:**
   * In Cloudflare Dashboard -> **SSL/TLS** -> **Origin Server**, generate a 15-year certificate for `divinefingershealthcare.ca` and `*.divinefingershealthcare.ca`.
   * On your VPS, save them:
     ```bash
     mkdir -p /etc/ssl/origin
     nano /etc/ssl/origin/fullchain.pem   # Paste Certificate
     nano /etc/ssl/origin/privkey.pem     # Paste Private Key
     chmod 600 /etc/ssl/origin/privkey.pem
     ```
4. **WAF Rate Limiting:**
   * Configure rate limiting on `/api/auth/*`, `/api/users/login`, `/api/users/forgot-password` (10 req / 10s per IP).

---

## Phase 3: Nginx & TLS Ingress

### 3.1 Install Cloudflare Real-IP Updater
```bash
bash /var/www/divine-fingers/deploy/nginx/update-cloudflare-ips.sh

# Add weekly cron job to keep Cloudflare IP blocks up to date
(crontab -l 2>/dev/null; echo "0 3 * * 1 /var/www/divine-fingers/deploy/nginx/update-cloudflare-ips.sh > /dev/null 2>&1") | crontab -
```

### 3.2 Deploy Nginx Virtual Host
```bash
cp /var/www/divine-fingers/deploy/nginx/app-proxy.conf /etc/nginx/snippets/app-proxy.conf
cp /var/www/divine-fingers/deploy/nginx/yourdomain.conf /etc/nginx/sites-available/divinefingers.conf

# Enable virtual host
ln -sf /etc/nginx/sites-available/divinefingers.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test configuration and reload
nginx -t
systemctl reload nginx
```

---

## Phase 4: Application & Systemd Services

### 4.1 Production Secrets Configuration
Copy the template and populate production values:
```bash
cp /var/www/divine-fingers/.env.example /var/www/divine-fingers/.env
chown app:app /var/www/divine-fingers/.env
chmod 600 /var/www/divine-fingers/.env

nano /var/www/divine-fingers/.env
```
Generate cryptographic keys with `openssl rand -hex 32` for:
* `JWT_ADMIN_SECRET`
* `JWT_USER_SECRET` (must be different from admin secret)
* `ENCRYPTION_KEY`
* `OUTBOX_ENC_KEY`
* `EMAIL_WEBHOOK_SECRET`

### 4.2 Initialize Production Database
1. Launch MySQL 8.0 on loopback (`127.0.0.1`):
   ```bash
   docker compose -f /var/www/divine-fingers/deploy/docker-compose.prod.yml --env-file /var/www/divine-fingers/.env up -d
   ```
2. Verify container is healthy and bound to `127.0.0.1:3306`:
   ```bash
   ss -tlnp | grep 3306
   ```
3. Apply least-privilege user script:
   ```bash
   mysql -h 127.0.0.1 -u root -p divine_fingers_prod < /var/www/divine-fingers/deploy/sql/01_least_privilege_user.sql
   ```

### 4.3 Install Node Dependencies
```bash
cd /var/www/divine-fingers
sudo -u app npm ci --omit=dev
```

### 4.4 Install & Start Systemd Services
```bash
cp /var/www/divine-fingers/deploy/systemd/*.service /etc/systemd/system/
systemctl daemon-reload

# Enable and start the 3 independent services
systemctl enable --now app-web.service
systemctl enable --now app-mail-worker.service
systemctl enable --now app-shift-lifecycle.service

# Verify service health
systemctl status app-web.service app-mail-worker.service app-shift-lifecycle.service
```

---

## Phase 5: Email DNS & Hostinger Mail Relay

Configure SPF, DKIM, DMARC, and MTA-STS records in Cloudflare DNS according to [DNS Email Records Guide](file:///docs/dns-email-records.md):
1. **SPF:** `v=spf1 include:_spf.mail.hostinger.com -all` on `notify.divinefingershealthcare.ca`.
2. **DKIM:** Publish selector records from Hostinger Email Control Panel.
3. **DMARC Stage 1:** `v=DMARC1; p=none; rua=mailto:dmarc-reports@divinefingershealthcare.ca; fo=1;`
4. **Test Delivery:** Send a test message and verify 10/10 deliverability score on `mail-tester.com`.

---

## Phase 6: Post-Deployment Verification Tests

Run the security test suite directly on the server:
```bash
sudo -u app npm test
```
Verify the 4 Priority 0 vulnerabilities are closed:
1. **Source Code Exposure Check:**
   ```bash
   curl -I https://divinefingershealthcare.ca/server.js       # Must return 404
   curl -I https://divinefingershealthcare.ca/package.json    # Must return 404
   curl -I https://divinefingershealthcare.ca/schema.sql      # Must return 404
   curl -I https://divinefingershealthcare.ca/uploads/        # Must return 404
   curl -I https://divinefingershealthcare.ca/index.html      # Must return 200
   ```
2. **Port Exposure Check:**
   ```bash
   ss -tlnp
   ```
   *Confirm only ports 22, 80, and 443 listen on `0.0.0.0`. Port 3306 and port 3000 must strictly listen on `127.0.0.1`.*

---

## Phase 7: DMARC Progressive Rollout

After monitoring incoming DMARC reports for 14 days without legitimate mail rejection:
1. **Day 15:** Tighten policy to `p=quarantine; pct=25;`
2. **Day 30:** Tighten policy to `p=quarantine; pct=100;`
3. **Day 45:** Finalize policy at strict enforcement: `p=reject; aspf=s; adkim=s;`

---

## Phase 8: Encrypted Backups & Disaster Recovery

1. Configure nightly backup cron:
   ```bash
   (crontab -l 2>/dev/null; echo "0 2 * * * /var/www/divine-fingers/deploy/backup.sh > /var/log/backup.log 2>&1") | crontab -
   ```
2. **Quarterly Disaster Recovery Drill:**
   To test database restore on a staging instance:
   ```bash
   # Decrypt archive
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in db_*.enc -out restore.sql.gz -k "$BACKUP_ENCRYPTION_KEY"
   
   # Pipe into clean MySQL database
   gzip -dc restore.sql.gz | mysql -h 127.0.0.1 -u root -p divine_fingers_test_restore
   ```
