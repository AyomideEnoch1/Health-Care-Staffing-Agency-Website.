# Hostinger & Vercel Production Deployment Guide (Option B: Hybrid Architecture)
**Divine Fingers Healthcare Services Inc.**

This guide details deploying the **Node.js Express API and MySQL Database to Hostinger**, while maintaining the **Static Frontend on Vercel**.

---

## Part 1: Hostinger MySQL Database Setup

1. **Log in to Hostinger hPanel**: Navigate to **Databases → Management**.
2. **Create New Database**:
   - **Database Name:** e.g. `u123456789_divine_fingers_db`
   - **Username:** e.g. `u123456789_df_app`
   - **Password:** Generate a strong 24+ character password.
3. **Import Relational Schema**:
   - Click **Enter phpMyAdmin**.
   - Select your newly created database.
   - Click **Import** → upload [`schema.sql`](file:///c:/Users/Ayomide%20Enoch/Desktop/Mr%20Adeyemi%202/schema.sql) and execute.
4. **One-Time Super-Admin Bootstrap (Clean DB Initialization)**:
   - Connect via Hostinger SSH Terminal to the app directory:
     ```bash
     cd /public_html/api
     node scripts/create-first-admin.js "admin@divinefingershealthcare.ca" "Divine Fingers Administrator" "YourSuperSecurePassword2026!"
     ```
   - **Security Precondition & Idempotency**: The script strictly checks `SELECT COUNT(*) FROM admins` and will **refuse to run** if any administrator account already exists.
   - **Post-Bootstrap Security Notice**: This script is sensitive. It is not exposed over HTTP, and all subsequent administrator accounts (`dispatch`, `care-coordinator`, or additional `super-admin`) must be created exclusively via the authenticated Super-Admin Settings panel in the Admin Dashboard.
5. **Scoped Database Privileges**:
   - Verify the database user has only `SELECT`, `INSERT`, `UPDATE`, `DELETE` privileges on the application database (no global `DROP` or `GRANT`).

---

## Part 2: Hostinger Node.js API Deployment

1. **Configure Subdomain in hPanel**:
   - In Hostinger hPanel, go to **Domains → Subdomains**.
   - Create a subdomain for your API: `api.divinefingershealthcare.ca` pointing to `/public_html/api` (or custom directory).
2. **Create Node.js Application**:
   - Go to **Advanced → Node.js** in hPanel.
   - **Node.js Version:** Select **v20.x LTS**.
   - **Application Root:** `/public_html/api`
   - **Application Startup File:** `server.js`
3. **Upload Backend Files**:
   - Upload the backend files to `/public_html/api`:
     - `server.js`, `db.js`, `package.json`, `package-lock.json`
     - `routes/`, `middleware/`, `utils/`
4. **Create Secure Uploads Directory (SSH)**:
   Connect via Hostinger SSH Terminal and create a protected directory outside the public web root:
   ```bash
   mkdir -p /home/u123456789/secure_uploads/resumes
   chmod 700 /home/u123456789/secure_uploads/resumes
   ```
5. **Set Production Environment Variables**:
   In the Hostinger Node.js App configuration (or `.env` in the app root):
   ```ini
   NODE_ENV=production
   PORT=3000
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=u123456789_df_app
   DB_PASSWORD=YourSecureMySQLPassword
   DB_NAME=u123456789_divine_fingers_db
   JWT_SECRET=Your64CharCryptographicSecretKey
   UPLOAD_DIR=/home/u123456789/secure_uploads/resumes
   SMTP_HOST=smtp.hostinger.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=info@divinefingershealthcare.ca
   SMTP_PASS=YourHostingerEmailPassword
   AGENCY_ALERT_EMAIL=info@divinefingershealthcare.ca
   ALLOWED_ORIGINS=https://divinefingershealthcare.ca,https://www.divinefingershealthcare.ca,https://health-care-staffing-agency-website.vercel.app
   ```
6. **Install Production Packages & Start Server**:
   ```bash
   npm install --omit=dev
   npm run start
   ```

---

## Part 3: Vercel Frontend Configuration

1. **Point Frontend to Hostinger API**:
   In your Vercel deployment project settings or in `index.html` / `script.js` / `admin.js`, set:
   ```javascript
   window.API_BASE_URL = 'https://api.divinefingershealthcare.ca/api';
   ```
2. **Deploy to Vercel**:
   Push the sanitized frontend HTML, CSS, JS, and asset files to your Git repository connected to Vercel.
3. **Verify SSL / HTTPS**:
   Ensure both `https://divinefingershealthcare.ca` and `https://api.divinefingershealthcare.ca` have active Let's Encrypt SSL certificates.

---

## Part 4: Automated Database Backups (Hostinger Cron)

Add a scheduled Cron Job in Hostinger hPanel to run every day at 2:00 AM:
```bash
0 2 * * * mysqldump -u u123456789_df_app -p'YourSecurePassword' u123456789_divine_fingers_db | gzip > /home/u123456789/backups/df_db_$(date +\%F).sql.gz
```
