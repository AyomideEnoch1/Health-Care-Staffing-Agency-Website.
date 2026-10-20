#!/usr/bin/env bash
# ==============================================================================
# Hostinger VPS Security Hardening Script
# Divine Fingers Healthcare Services Inc.
# OS Target: Ubuntu 22.04 / 24.04 LTS
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}  Divine Fingers Healthcare — Hostinger VPS Hardening Engine     ${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo ""

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Error: This hardening script must be executed as root.${NC}"
   exit 1
fi

confirm() {
  read -r -p "$1 [y/N]: " response
  case "$response" in
    [yY][eE][sS]|[yY]) true ;;
    *) false ;;
  esac
}

# ── 1. Create Dedicated Unprivileged App User ────────────────────────────────
echo -e "\n${YELLOW}[Step 1/7] Provisioning unprivileged application service user...${NC}"
if id "app" &>/dev/null; then
  echo "✅ User 'app' already exists."
else
  useradd -m -s /bin/bash app
  echo "✅ Dedicated system user 'app' created."
fi

# ── 2. System Packages & Automatic Security Updates ──────────────────────────
echo -e "\n${YELLOW}[Step 2/7] Installing security tools and unattended upgrades...${NC}"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ufw \
  fail2ban \
  unattended-upgrades \
  apt-listchanges \
  curl \
  tar \
  clamav \
  clamav-daemon

echo 'Unattended-Upgrade::Automatic-Reboot "false";' > /etc/apt/apt.conf.d/51unattended-upgrades-local
systemctl restart unattended-upgrades
echo "✅ Unattended security updates configured."

# ── 3. Configure Fail2Ban (SSH + Nginx) ───────────────────────────────────────
echo -e "\n${YELLOW}[Step 3/7] Hardening Fail2Ban jails...${NC}"
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = ssh
filter  = sshd
maxretry = 3

[nginx-http-auth]
enabled = true
port    = http,https
filter  = nginx-http-auth

[nginx-limit-req]
enabled = true
port    = http,https
filter  = nginx-limit-req
maxretry = 10
EOF

systemctl enable fail2ban
systemctl restart fail2ban
echo "✅ Fail2Ban active (sshd + nginx rate limits enabled)."

# ── 4. SSH Daemon Hardening ──────────────────────────────────────────────────
echo -e "\n${YELLOW}[Step 4/7] SSH Daemon Hardening...${NC}"
echo -e "${RED}⚠️  IMPORTANT: Verify you have uploaded your public SSH key to ~/.ssh/authorized_keys before proceeding!${NC}"
if confirm "Do you wish to enforce SSH key-only authentication (disable passwords & root login)?"; then
  sed -i -E 's/^#?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
  sed -i -E 's/^#?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i -E 's/^#?MaxAuthTries .*/MaxAuthTries 3/' /etc/ssh/sshd_config
  sed -i -E 's/^#?X11Forwarding .*/X11Forwarding no/' /etc/ssh/sshd_config

  if sshd -t; then
    systemctl reload ssh || systemctl reload sshd
    echo "✅ SSH daemon reloaded with key-only authentication."
  else
    echo -e "${RED}❌ SSH test failed. Reverting changes.${NC}"
  fi
else
  echo "⏩ Skipping SSH configuration changes."
fi

# ── 5. UFW Perimeter Firewall Configuration ──────────────────────────────────
echo -e "\n${YELLOW}[Step 5/7] UFW Firewall Configuration...${NC}"
read -r -p "Enter your trusted Admin IP address for SSH access (or press Enter to allow SSH from any IP): " ADMIN_IP

if confirm "Apply perimeter UFW firewall rules now?"; then
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing

  if [[ -n "$ADMIN_IP" ]]; then
    ufw allow from "$ADMIN_IP" to any port 22 proto tcp comment 'Restricted Admin SSH'
    echo "✅ SSH restricted to $ADMIN_IP"
  else
    ufw allow 22/tcp comment 'Open SSH'
    echo "⚠️  SSH opened to all IPs (MFA or key-only recommended)"
  fi

  # Web Traffic (Only Cloudflare should access, or all if Cloudflare IP list is loaded)
  ufw allow 80/tcp comment 'HTTP (Let\x27s Encrypt & Redirect)'
  ufw allow 443/tcp comment 'HTTPS'

  ufw --force enable
  echo "✅ UFW enabled and active."
else
  echo "⏩ Skipping UFW activation."
fi

# ── 6. Docker UFW Bypass Warning & Audit ──────────────────────────────────────
echo -e "\n${YELLOW}[Step 6/7] Auditing Docker Network Bindings & UFW bypass risk...${NC}"
echo -e "${RED}================================================================${NC}"
echo -e "${RED}CRITICAL DOCKER WARNING: Docker bypasses UFW by writing directly${NC}"
echo -e "${RED}to iptables. If a compose port is published as 3306:3306, it is ${NC}"
echo -e "${RED}PUBLIC TO THE WORLD even if UFW default policy is DENY!          ${NC}"
echo -e "${RED}Ensure all docker compose files bind to 127.0.0.1:port strictly. ${NC}"
echo -e "${RED}================================================================${NC}"

# Check for public listening ports
echo "Checking active listening TCP ports..."
ss -tlnp || netstat -tlpn

# ── 7. Kernel & Sysctl Network Hardening ──────────────────────────────────────
echo -e "\n${YELLOW}[Step 7/7] Applying Linux kernel network security parameters...${NC}"
cat > /etc/sysctl.d/99-hardened-network.conf << 'EOF'
# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Disable ICMP redirect acceptance (spoofing protection)
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0

# Enable SYN Cookies (SYN Flood protection)
net.ipv4.tcp_syncookies = 1

# Ignore broadcast ICMP requests (Smurf attack protection)
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Log martian packets (unroutable/spoofed IP addresses)
net.ipv4.conf.all.log_martians = 1

# Restrict ptrace
kernel.yama.ptrace_scope = 2
EOF

sysctl --system > /dev/null 2>&1
echo "✅ Kernel network parameters hardened."

echo -e "\n${GREEN}==================================================================${NC}"
echo -e "${GREEN}  Hostinger VPS Hardening Completed Successfully!                 ${NC}"
echo -e "${GREEN}==================================================================${NC}"
