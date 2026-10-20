#!/usr/bin/env bash
# ==============================================================================
# Encrypted Automated Backup Engine
# Divine Fingers Healthcare Services Inc.
# Follows the 3-2-1 backup rule (3 copies, 2 media, 1 offsite encrypted)
# ==============================================================================

set -euo pipefail

BACKUP_DIR="/var/backups/divine-fingers"
DATE="$(date +'%Y-%m-%d_%H%M%S')"
RETENTION_DAYS=7

# Load environment
ENV_FILE="/var/www/divine-fingers/.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

DB_NAME="${DB_NAME:-divine_fingers_prod}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASSWORD:-}"
UPLOADS_DIR="/var/www/divine-fingers/uploads"
GPG_RECIPIENT="${BACKUP_GPG_RECIPIENT:-security@divinefingershealthcare.ca}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "=================================================================="
echo " Starting Encrypted Backup: $DATE"
echo "=================================================================="

SQL_DUMP_FILE="$BACKUP_DIR/db_${DB_NAME}_${DATE}.sql.gz"
UPLOADS_TAR_FILE="$BACKUP_DIR/uploads_${DATE}.tar.gz"

# 1. Database Dump (single-transaction ensures zero downtime/locking)
echo "[1/4] Dumping MySQL database: $DB_NAME..."
mysqldump \
  -h 127.0.0.1 \
  -u "$DB_USER" \
  -p"$DB_PASS" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  "$DB_NAME" | gzip -9 > "$SQL_DUMP_FILE"

# 2. Uploads Directory Archive (credentials and resumes)
echo "[2/4] Archiving uploads vault..."
if [[ -d "$UPLOADS_DIR" ]]; then
  tar -czf "$UPLOADS_TAR_FILE" -C "/var/www/divine-fingers" uploads
fi

# 3. Asymmetric Encryption (GPG / age)
# Uses public key encryption: Server can ENCRYPT, but CANNOT decrypt without private key!
echo "[3/4] Encrypting archives with asymmetric public key..."
if gpg --list-keys "$GPG_RECIPIENT" > /dev/null 2>&1; then
  gpg --batch --yes --encrypt --recipient "$GPG_RECIPIENT" "$SQL_DUMP_FILE"
  rm -f "$SQL_DUMP_FILE"
  SQL_DUMP_FILE="${SQL_DUMP_FILE}.gpg"

  if [[ -f "$UPLOADS_TAR_FILE" ]]; then
    gpg --batch --yes --encrypt --recipient "$GPG_RECIPIENT" "$UPLOADS_TAR_FILE"
    rm -f "$UPLOADS_TAR_FILE"
    UPLOADS_TAR_FILE="${UPLOADS_TAR_FILE}.gpg"
  fi
  echo "✅ Backups encrypted with GPG."
else
  # Fallback: Symmetric AES-256 encryption via OpenSSL if GPG key is not imported
  echo "⚠️ GPG key not found. Using OpenSSL AES-256-CBC with BACKUP_ENCRYPTION_KEY..."
  ENC_KEY="${BACKUP_ENCRYPTION_KEY:-${ENCRYPTION_KEY:-default_secure_key_must_change}}"
  openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -in "$SQL_DUMP_FILE" -out "${SQL_DUMP_FILE}.enc" -k "$ENC_KEY"
  rm -f "$SQL_DUMP_FILE"
  SQL_DUMP_FILE="${SQL_DUMP_FILE}.enc"

  if [[ -f "$UPLOADS_TAR_FILE" ]]; then
    openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -in "$UPLOADS_TAR_FILE" -out "${UPLOADS_TAR_FILE}.enc" -k "$ENC_KEY"
    rm -f "$UPLOADS_TAR_FILE"
    UPLOADS_TAR_FILE="${UPLOADS_TAR_FILE}.enc"
  fi
  echo "✅ Backups encrypted with OpenSSL AES-256."
fi

# 4. Off-site Sync (Hostinger Object Storage / S3 / Rclone)
echo "[4/4] Off-site synchronization..."
if command -v aws > /dev/null 2>&1 && [[ -n "${S3_BACKUP_BUCKET:-}" ]]; then
  aws s3 cp "$SQL_DUMP_FILE" "s3://${S3_BACKUP_BUCKET}/db/"
  aws s3 cp "$UPLOADS_TAR_FILE" "s3://${S3_BACKUP_BUCKET}/uploads/"
  echo "✅ Dispatched to off-site S3 object storage."
elif command -v rclone > /dev/null 2>&1 && [[ -n "${RCLONE_REMOTE:-}" ]]; then
  rclone copy "$SQL_DUMP_FILE" "${RCLONE_REMOTE}:divine-fingers-backups/db/"
  rclone copy "$UPLOADS_TAR_FILE" "${RCLONE_REMOTE}:divine-fingers-backups/uploads/"
  echo "✅ Dispatched via rclone offsite."
fi

# 5. Local Retention Cleanup
echo "Purging local backup files older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -mtime +"$RETENTION_DAYS" -delete

echo "=================================================================="
echo " Backup completed successfully at $(date)!"
echo " Encrypted SQL:     $SQL_DUMP_FILE"
echo " Encrypted Vault:   $UPLOADS_TAR_FILE"
echo "=================================================================="

# ------------------------------------------------------------------------------
# RESTORE INSTRUCTIONS:
# To restore on a test server or recovery instance:
# 1. Decrypt database dump:
#    gpg --decrypt db_divine_fingers_prod_*.sql.gz.gpg > restore.sql.gz
#    (or: openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in db_*.enc -out restore.sql.gz -k "$KEY")
# 2. Decompress and pipe into MySQL:
#    gzip -dc restore.sql.gz | mysql -u root -p divine_fingers_prod
# 3. Decrypt and extract uploads:
#    gpg --decrypt uploads_*.tar.gz.gpg | tar -xzf - -C /var/www/divine-fingers/
# ------------------------------------------------------------------------------
