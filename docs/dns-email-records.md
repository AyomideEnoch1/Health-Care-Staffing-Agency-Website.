# DNS, Email Authentication & Deliverability Guide
**Divine Fingers Healthcare Services Inc.**
Target Infrastructure: Hostinger VPS + Cloudflare Proxied DNS + Hostinger Mailing Service

---

## 1. Domain Architecture Overview

* **Primary Corporate Domain:** `divinefingershealthcare.ca` (or `yourdomain.com`)
* **Dedicated Transactional Subdomain:** `notify.divinefingershealthcare.ca` (or `notify.yourdomain.com`)
* **Hostinger Mail Relay:** `smtp.hostinger.com` (Port 465 SSL or Port 587 STARTTLS)

Isolating transactional system notifications (shift offers, password resets, verification codes) onto a dedicated `notify` subdomain protects corporate sender reputation if high-volume alerts trigger transient spam-box placement.

---

## 2. DNS Record Specifications

### A. SPF (Sender Policy Framework) Records

#### 1. Root Domain (`divinefingershealthcare.ca`)
Configures legitimate outbound web and office email servers.
* **Type:** `TXT`
* **Name:** `@`
* **Content:**
  ```text
  v=spf1 include:_spf.mail.hostinger.com ~all
  ```
  *(Once email alignment is verified in DMARC reports, tighten `~all` to `-all`)*.

#### 2. System Subdomain (`notify.divinefingershealthcare.ca`)
Strictly restricts transactional dispatches to the Hostinger mail cluster.
* **Type:** `TXT`
* **Name:** `notify`
* **Content:**
  ```text
  v=spf1 include:_spf.mail.hostinger.com -all
  ```

---

### B. DKIM (DomainKeys Identified Mail) Records

DKIM cryptographically signs outgoing message headers. Retrieve the exact selector public keys from your Hostinger Business Email control panel.

#### 1. Root Domain Selector
* **Type:** `CNAME` or `TXT` (based on Hostinger dashboard)
* **Name:** `hostingermail._domainkey` (or provider designated selector, e.g. `k1._domainkey`)
* **Content:**
  ```text
  v=DKIM1; k=rsa; p=<HOSTINGER_DKIM_PUBLIC_KEY>
  ```

#### 2. Notify Subdomain Selector
* **Type:** `TXT`
* **Name:** `hostingermail._domainkey.notify`
* **Content:**
  ```text
  v=DKIM1; k=rsa; p=<HOSTINGER_NOTIFY_DKIM_PUBLIC_KEY>
  ```

---

### C. DMARC 4-Phase Progressive Hardening Rollout

DMARC policy instructs receiving mail servers (Google Workspace, Microsoft 365, NHS, Ontario Health) how to treat unauthenticated emails. **Never start with `p=reject`**; follow this 4-phase rollout.

#### Phase 1: Monitoring & Audit (Day 1 – Day 14)
*Policy: `p=none`. Ingest aggregate reports without blocking mail.*
* **Type:** `TXT`
* **Name:** `_dmarc`
* **Content:**
  ```text
  v=DMARC1; p=none; sp=none; rua=mailto:dmarc-reports@divinefingershealthcare.ca; ruf=mailto:dmarc-forensics@divinefingershealthcare.ca; fo=1;
  ```

#### Phase 2: Quarantine Test (Day 15 – Day 30)
*Policy: `p=quarantine; pct=25`. Quarantine 25% of failing mail to Spam/Junk folder.*
* **Content:**
  ```text
  v=DMARC1; p=quarantine; pct=25; sp=quarantine; rua=mailto:dmarc-reports@divinefingershealthcare.ca; fo=1;
  ```

#### Phase 3: Full Quarantine (Day 31 – Day 45)
*Policy: `p=quarantine; pct=100`. 100% of unaligned emails routed to quarantine.*
* **Content:**
  ```text
  v=DMARC1; p=quarantine; pct=100; sp=quarantine; rua=mailto:dmarc-reports@divinefingershealthcare.ca; fo=1;
  ```

#### Phase 4: Strict Enforcement (Day 45+)
*Policy: `p=reject; aspf=s; adkim=s`. Malicious/spoofed emails are dropped at the perimeter.*
* **Content:**
  ```text
  v=DMARC1; p=reject; sp=reject; aspf=s; adkim=s; pct=100; rua=mailto:dmarc-reports@divinefingershealthcare.ca; ruf=mailto:dmarc-forensics@divinefingershealthcare.ca; fo=1;
  ```

---

### D. MTA-STS (Mail Transfer Agent Strict Transport Security) & TLS-RPT

Forces inbound mail agents to establish strict TLS 1.2+ connections and report downgrade/interception attempts.

#### 1. TLS Reporting Record
* **Type:** `TXT`
* **Name:** `_smtp._tls`
* **Content:**
  ```text
  v=TLSRPTv1; rua=mailto:tls-reports@divinefingershealthcare.ca
  ```

#### 2. MTA-STS DNS Pointer
* **Type:** `TXT`
* **Name:** `_mta-sts`
* **Content:**
  ```text
  v=STSv1; id=2026102001;
  ```

#### 3. MTA-STS Policy File
Host an HTTPS endpoint at `https://mta-sts.divinefingershealthcare.ca/.well-known/mta-sts.txt`:
```text
version: STSv1
mode: enforce
mx: mx1.hostinger.com
mx: mx2.hostinger.com
max_age: 604800
```

---

### E. CAA (Certificate Authority Authorization) Records

Restricts which CAs may issue SSL/TLS certificates for your domains.
* **Type:** `CAA`
* **Name:** `@`
* **Tag:** `issue`
* **Value:** `letsencrypt.org`
* **Tag:** `issue`
* **Value:** `hostinger.com`
* **Tag:** `iodef`
* **Value:** `mailto:security@divinefingershealthcare.ca`

---

### F. DNSSEC (DNS Security Extensions)

When using Cloudflare as your authoritative DNS provider:
1. Navigate to Cloudflare Dashboard -> **DNS** -> **Settings**.
2. Click **Enable DNSSEC**.
3. Copy the DS record (`Key Tag`, `Algorithm`, `Digest Type`, `Digest`).
4. Paste the DS record into your Hostinger Domain registrar control panel under **DNSSEC Management**.
5. Validates cryptographic provenance of all DNS responses and thwarts cache poisoning.
