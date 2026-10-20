# Cloudflare Perimeter Hardening & Setup Guide
**Divine Fingers Healthcare Services Inc.**
Edge Proxy, WAF, Bot Fight Mode & Origin Lockdown Runbook

---

## 1. Cloudflare DNS & Proxy Status

1. Ensure the following DNS records are configured with **Proxy status: Proxied (Orange Cloud)**:
   * `A` record: `@` -> Points to your Hostinger VPS IPv4.
   * `CNAME` record: `www` -> Points to `@`.
   * `A` record: `mta-sts` -> Points to your Hostinger VPS IPv4.
2. Ensure email server records (Hostinger MX, SPF, DKIM) are **DNS Only (Grey Cloud)**:
   * `MX` records must NEVER be proxied through Cloudflare.

---

## 2. SSL/TLS Mode: Full (Strict)

1. In the Cloudflare Dashboard, navigate to **SSL/TLS** -> **Overview**.
2. Select **Full (strict)**.
   * *Rationale:* Guarantees end-to-end encryption between Cloudflare edge servers and your Hostinger Nginx origin.
3. In **SSL/TLS** -> **Origin Server**:
   * Click **Create Certificate**.
   * Leave defaults: RSA 2048 or ECDSA, hostnames: `divinefingershealthcare.ca`, `*.divinefingershealthcare.ca`.
   * Validity: 15 years.
   * Copy the generated certificate to `/etc/ssl/origin/fullchain.pem` on your VPS.
   * Copy the private key to `/etc/ssl/origin/privkey.pem` on your VPS (`chmod 600 /etc/ssl/origin/privkey.pem`).
4. In **SSL/TLS** -> **Edge Certificates**:
   * Enable **Always Use HTTPS**.
   * Set **Minimum TLS Version** to `TLS 1.2`.
   * Enable **Opportunistic Encryption** and **TLS 1.3**.

---

## 3. Web Application Firewall (WAF) & Rate Limiting Rules

In Cloudflare Dashboard -> **Security** -> **WAF**:

### Rule 1: Edge Rate Limiting on Authentication & Reset Endpoints
* **Rule Name:** `Protect Auth and Password Reset`
* **If incoming requests match:**
  * `URI Path` contains `/api/auth/` OR `URI Path` contains `/api/users/login` OR `URI Path` contains `/api/users/forgot-password` OR `URI Path` contains `/api/users/reset-password`
* **Rate Limiting Criteria:**
  * When rate exceeds: **10 requests per 10 seconds** per IP.
  * Mitigation action: **Block** (or Managed Challenge) for **15 minutes**.

### Rule 2: Contact Form Abuse Defense
* **Rule Name:** `Throttle Public Form Ingestion`
* **If incoming requests match:**
  * `URI Path` equals `/api/contact` AND `Request Method` equals `POST`
* **Rate Limiting Criteria:**
  * When rate exceeds: **5 requests per minute** per IP.
  * Action: **Managed Challenge**.

### Rule 3: Cloudflare Managed Rules & OWASP Core Ruleset
* In **Managed Rules**, enable:
  * **Cloudflare Managed Ruleset** (Deployment status: Active, Sensitivity: High).
  * **Cloudflare OWASP Core Ruleset** (Paranoia Level: PL1, Action: Block on Anomaly Score > 40).

---

## 4. Bot Fight Mode & Turnstile

1. In **Security** -> **Bots**:
   * Enable **Bot Fight Mode** (challenges requests matching known scraper/bot signatures).
2. In **Turnstile** (Free CAPTCHA alternative):
   * Create a widget for your domain.
   * Add the Site Key to your frontend contact and login forms.
   * Add the Secret Key to your VPS `.env` as `CLOUDFLARE_TURNSTILE_SECRET_KEY`.

---

## 5. Origin Firewall Lockdown (Blocking Direct IP Access)

Attackers often bypass Cloudflare WAF by connecting directly to the Hostinger VPS IP address. To prevent this:

1. **UFW Cloudflare IP Lockdown:**
   On your VPS, load Cloudflare IP ranges into UFW so ONLY Cloudflare can reach ports 80 and 443:
   ```bash
   for ip in $(curl -s https://www.cloudflare.com/ips-v4); do ufw allow from "$ip" to any port 80,443 proto tcp; done
   for ip in $(curl -s https://www.cloudflare.com/ips-v6); do ufw allow from "$ip" to any port 80,443 proto tcp; done
   ```
2. **Authenticated Origin Pulls (AOP):**
   * In Cloudflare Dashboard -> **SSL/TLS** -> **Origin Server**, enable **Authenticated Origin Pulls**.
   * Download the Cloudflare origin pull CA certificate to `/etc/ssl/cloudflare/origin-pull-ca.pem`.
   * In Nginx virtual host, uncomment:
     ```nginx
     ssl_client_certificate /etc/ssl/cloudflare/origin-pull-ca.pem;
     ssl_verify_client on;
     ```
   * Now, any direct request to your server IP that does not present Cloudflare's client TLS certificate is rejected at the TLS handshake.

---

## 6. Cloudflare Access for `/admin` Console

1. Navigate to Cloudflare **Zero Trust** -> **Access** -> **Applications**.
2. Add an Application -> **Self-hosted**:
   * Application name: `Divine Fingers Dispatch Admin`
   * Path: `divinefingershealthcare.ca/admin*`
   * Policy: Allow only designated management emails (e.g., `@divinefingershealthcare.ca`) with One-Time PIN or Google/Microsoft Workspace SSO.
3. Provides an enterprise-grade identity boundary before visitors can even reach the Node.js login endpoint.
