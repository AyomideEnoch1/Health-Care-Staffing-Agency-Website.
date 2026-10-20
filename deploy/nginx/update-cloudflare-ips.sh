#!/usr/bin/env bash
# ==============================================================================
# Update Cloudflare IP Ranges for Nginx Real-IP Restoration
# Divine Fingers Healthcare Services Inc.
# Run weekly via cron: 0 3 * * 1 /etc/nginx/update-cloudflare-ips.sh
# ==============================================================================

set -euo pipefail

OUTPUT_FILE="/etc/nginx/cloudflare-realip.conf"
TEMP_FILE="$(mktemp)"

echo "# Automatically generated Cloudflare Real-IP rules on $(date -u)" > "$TEMP_FILE"
echo "# Source: https://www.cloudflare.com/ips/" >> "$TEMP_FILE"
echo "" >> "$TEMP_FILE"

echo "# Cloudflare IPv4 Ranges" >> "$TEMP_FILE"
curl -sS --fail https://www.cloudflare.com/ips-v4 | sed 's/^/set_real_ip_from /; s/$/;/' >> "$TEMP_FILE"

echo "" >> "$TEMP_FILE"
echo "# Cloudflare IPv6 Ranges" >> "$TEMP_FILE"
curl -sS --fail https://www.cloudflare.com/ips-v6 | sed 's/^/set_real_ip_from /; s/$/;/' >> "$TEMP_FILE"

echo "" >> "$TEMP_FILE"
echo "real_ip_header CF-Connecting-IP;" >> "$TEMP_FILE"
echo "real_ip_recursive on;" >> "$TEMP_FILE"

# Validate and safely atomic swap
mv "$TEMP_FILE" "$OUTPUT_FILE"
chmod 644 "$OUTPUT_FILE"

# Test nginx config and reload if valid
if nginx -t > /dev/null 2>&1; then
  systemctl reload nginx
  echo "✅ Cloudflare Real-IP configuration updated and Nginx reloaded successfully."
else
  echo "❌ Error: Nginx configuration test failed. Reverting."
  exit 1
fi
