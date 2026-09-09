#!/usr/bin/env bash
#
# UKAF — Proxmox VE installer
#
# Run this ON THE PROXMOX HOST SHELL (not inside a container). It creates a
# new unprivileged LXC container, installs Node.js + PostgreSQL + the UKAF
# app inside it, and sets up a systemd service that auto-deploys whenever
# you push to the configured GitHub branch (via a webhook listener).
#
#   bash -c "$(wget -qLO - https://raw.githubusercontent.com/<you>/ukaf/main/deploy/proxmox-install.sh)"
#
# or, if you've already cloned the repo onto the Proxmox host:
#
#   bash deploy/proxmox-install.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Colours / helpers
# ---------------------------------------------------------------------------
RD='\033[0;31m'; GN='\033[0;32m'; YW='\033[1;33m'; BL='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BL}[info]${NC} $*"; }
ok()    { echo -e "${GN}[ok]${NC} $*"; }
warn()  { echo -e "${YW}[warn]${NC} $*"; }
die()   { echo -e "${RD}[error]${NC} $*" >&2; exit 1; }
ask()   { local prompt="$1" default="${2:-}"; local reply;
          if [ -n "$default" ]; then read -r -p "$prompt [$default]: " reply || true; echo "${reply:-$default}";
          else read -r -p "$prompt: " reply || true; echo "$reply"; fi; }

[ "$(id -u)" -eq 0 ] || die "Run this as root on the Proxmox host."
command -v pct >/dev/null 2>&1 || die "pct not found — this must be run on a Proxmox VE host."

echo -e "${GN}== UKAF Proxmox installer ==${NC}\n"

# ---------------------------------------------------------------------------
# Container configuration
# ---------------------------------------------------------------------------
CTID=$(ask "Container ID" "$(pvesh get /cluster/nextid)")
HOSTNAME=$(ask "Container hostname" "ukaf")
DISK_GB=$(ask "Disk size (GB)" "12")
CORES=$(ask "CPU cores" "2")
MEMORY_MB=$(ask "Memory (MB)" "2048")
SWAP_MB=$(ask "Swap (MB)" "512")

# Pick the first storage that can hold container root disks.
DEFAULT_STORAGE=$(pvesm status -content rootdir 2>/dev/null | awk 'NR==2{print $1}')
STORAGE=$(ask "Storage pool" "${DEFAULT_STORAGE:-local-lvm}")

DEFAULT_BRIDGE=$(awk -F'[ :]' '/^iface vmbr/{print $2; exit}' /etc/network/interfaces 2>/dev/null)
BRIDGE=$(ask "Network bridge" "${DEFAULT_BRIDGE:-vmbr0}")
NET_MODE=$(ask "Network (dhcp or a static CIDR like 192.168.1.50/24)" "dhcp")
GATEWAY=""
if [ "$NET_MODE" != "dhcp" ]; then
  GATEWAY=$(ask "Gateway IP" "")
fi

# ---------------------------------------------------------------------------
# App configuration
# ---------------------------------------------------------------------------
REPO_URL=$(ask "GitHub repo URL (https://github.com/you/ukaf.git)" "")
[ -n "$REPO_URL" ] || die "A repo URL is required."
BRANCH=$(ask "Branch to deploy" "main")
APP_PORT=$(ask "App port" "3002")
WEBHOOK_PORT=$(ask "Webhook listener port (point your GitHub webhook here)" "9000")
SITE_URL=$(ask "Public site URL (used for NEXT_PUBLIC_SITE_URL, e.g. https://ukaf.co.uk)" "http://localhost:${APP_PORT}")
WEBHOOK_SECRET=$(ask "GitHub webhook secret (blank = auto-generate)" "")
[ -n "$WEBHOOK_SECRET" ] || WEBHOOK_SECRET=$(openssl rand -hex 24)

PG_PASSWORD=$(openssl rand -hex 16)
AUTH_SECRET=$(openssl rand -hex 32)

# ---------------------------------------------------------------------------
# Template
# ---------------------------------------------------------------------------
TEMPLATE_STORAGE=$(ask "Template storage (where LXC templates live)" "local")
TEMPLATE="debian-12-standard_12.7-1_amd64.tar.zst"
info "Checking for Debian 12 template..."
pveam update >/dev/null 2>&1 || true
if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -q "$TEMPLATE"; then
  LATEST=$(pveam available -section system 2>/dev/null | awk '/debian-12-standard/{print $2}' | sort -V | tail -1)
  TEMPLATE="${LATEST:-$TEMPLATE}"
  info "Downloading template $TEMPLATE..."
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
fi

# ---------------------------------------------------------------------------
# Create + start the container
# ---------------------------------------------------------------------------
info "Creating CT $CTID ($HOSTNAME)..."
NET_ARG="name=eth0,bridge=${BRIDGE}"
if [ "$NET_MODE" = "dhcp" ]; then
  NET_ARG="${NET_ARG},ip=dhcp"
else
  NET_ARG="${NET_ARG},ip=${NET_MODE}"
  [ -n "$GATEWAY" ] && NET_ARG="${NET_ARG},gw=${GATEWAY}"
fi

pct create "$CTID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
  --hostname "$HOSTNAME" \
  --cores "$CORES" \
  --memory "$MEMORY_MB" \
  --swap "$SWAP_MB" \
  --rootfs "${STORAGE}:${DISK_GB}" \
  --net0 "$NET_ARG" \
  --unprivileged 1 \
  --features nesting=1 \
  --onboot 1 \
  --start 0

pct start "$CTID"
ok "Container $CTID started. Waiting for network..."
for i in $(seq 1 30); do
  pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break
  sleep 2
done

# ---------------------------------------------------------------------------
# Push the in-container setup script and run it
# ---------------------------------------------------------------------------
SETUP_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lxc-setup.sh"
if [ ! -f "$SETUP_SRC" ]; then
  die "lxc-setup.sh not found next to this script — clone the full deploy/ directory."
fi

pct push "$CTID" "$SETUP_SRC" /root/lxc-setup.sh
pct exec "$CTID" -- chmod +x /root/lxc-setup.sh

info "Running in-container setup (this installs Node, PostgreSQL, builds the app)..."
pct exec "$CTID" -- /root/lxc-setup.sh \
  "$REPO_URL" "$BRANCH" "$APP_PORT" "$WEBHOOK_PORT" "$WEBHOOK_SECRET" \
  "$SITE_URL" "$PG_PASSWORD" "$AUTH_SECRET"

CT_IP=$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}')

echo
ok "UKAF is installed in CT $CTID."
echo
echo -e "  App:            ${GN}http://${CT_IP}:${APP_PORT}${NC}"
echo -e "  Sign in:        admin@ukaf.co.uk / ChangeMe!2024  (change this immediately)"
echo -e "  Webhook URL:    ${GN}http://${CT_IP}:${WEBHOOK_PORT}/webhook${NC}"
echo -e "  Webhook secret: ${YW}${WEBHOOK_SECRET}${NC}"
echo
echo "Next steps:"
echo "  1. Reverse-proxy ${CT_IP}:${APP_PORT} (and optionally :${WEBHOOK_PORT}) through Cloudflare / your ingress."
echo "  2. In GitHub -> repo Settings -> Webhooks -> Add webhook:"
echo "       Payload URL:  https://<your-domain-or-tunnel>/webhook  (points at :${WEBHOOK_PORT})"
echo "       Content type: application/json"
echo "       Secret:       ${WEBHOOK_SECRET}"
echo "       Events:       Just the push event"
echo "  3. Edit /home/ukaf/app/.env inside the container for real Stripe/Resend keys:"
echo "       pct exec ${CTID} -- nano /home/ukaf/app/.env"
echo "       pct exec ${CTID} -- systemctl restart ukaf"
echo
echo "From now on, every push to '${BRANCH}' triggers: git pull, npm ci, prisma migrate deploy, build, restart."
