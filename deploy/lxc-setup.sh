#!/usr/bin/env bash
#
# UKAF — in-container setup. Run *inside* the LXC by proxmox-install.sh.
# Not meant to be run directly unless you know what you're doing.
#
# Args: REPO_URL BRANCH APP_PORT WEBHOOK_PORT WEBHOOK_SECRET SITE_URL PG_PASSWORD AUTH_SECRET [ADMIN_PORT]
#
set -euo pipefail

REPO_URL="${1:?repo url required}"
BRANCH="${2:-main}"
APP_PORT="${3:-3002}"
WEBHOOK_PORT="${4:-9000}"
WEBHOOK_SECRET="${5:?webhook secret required}"
SITE_URL="${6:-http://localhost:${APP_PORT}}"
PG_PASSWORD="${7:?postgres password required}"
AUTH_SECRET="${8:?auth secret required}"
ADMIN_PORT="${9:-3003}"

APP_DIR=/home/ukaf/app
DEPLOY_LOG=/var/log/ukaf-deploy.log

echo "[1/8] Installing base packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates gnupg build-essential postgresql postgresql-contrib sudo

echo "[2/8] Installing Node.js 20..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "[3/8] Creating system user 'ukaf'..."
id -u ukaf >/dev/null 2>&1 || useradd -m -s /bin/bash ukaf

echo "[4/8] Setting up PostgreSQL..."
systemctl enable --now postgresql
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='ukaf'\"" | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE ROLE ukaf LOGIN PASSWORD '${PG_PASSWORD}';\""
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='ukaf'\"" | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE DATABASE ukaf OWNER ukaf;\""

echo "[5/8] Cloning the app..."
if [ -d "$APP_DIR/.git" ]; then
  su - ukaf -c "cd $APP_DIR && git fetch origin && git checkout ${BRANCH} && git reset --hard origin/${BRANCH}"
else
  su - ukaf -c "git clone --branch ${BRANCH} ${REPO_URL} ${APP_DIR}"
fi

echo "[6/8] Writing .env and installing dependencies..."
cat > "${APP_DIR}/.env" <<EOF
DATABASE_URL="postgresql://ukaf:${PG_PASSWORD}@localhost:5432/ukaf?schema=public"
NEXT_PUBLIC_SITE_URL="${SITE_URL}"
AUTH_SECRET="${AUTH_SECRET}"
BASE_CURRENCY="GBP"
NEXT_PUBLIC_BASE_CURRENCY="GBP"
NEXT_PUBLIC_COMPANY_NAME="UKAF Commercials Ltd"
NEXT_PUBLIC_COMPANY_NUMBER="09876543"
NEXT_PUBLIC_VAT_NUMBER="GB123456789"
NEXT_PUBLIC_COMPANY_ADDRESS="Unit 4, Trafford Park, Manchester, M17 1AB"
NEXT_PUBLIC_COMPANY_PHONE="+44 161 000 0000"
NEXT_PUBLIC_COMPANY_EMAIL="sales@ukaf.co.uk"
SEED_ADMIN_EMAIL="admin@ukaf.co.uk"
SEED_ADMIN_PASSWORD="ChangeMe!2024"
# The admin instance (ukaf-admin.service, port ${ADMIN_PORT}) always serves
# /admin regardless of hostname. Set this to whatever origin reaches that
# port/domain (e.g. http://<container-ip>:${ADMIN_PORT} or
# https://admin.yourdomain.com) so CSRF accepts requests from it too.
ADMIN_SITE_URL=""
# Fill these in for production — payments and email will no-op until you do:
STRIPE_SECRET_KEY=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""
RESEND_API_KEY=""
EMAIL_FROM="UKAF Commercials <sales@ukaf.co.uk>"
EMAIL_REPLY_TO="sales@ukaf.co.uk"
SALES_NOTIFICATION_EMAILS="sales@ukaf.co.uk"
CRON_SECRET=""
EOF
chown ukaf:ukaf "${APP_DIR}/.env"
chmod 600 "${APP_DIR}/.env"

su - ukaf -c "cd ${APP_DIR} && npm ci"

echo "[7/8] Running migrations, seed and build..."
su - ukaf -c "cd ${APP_DIR} && npx prisma migrate deploy"
su - ukaf -c "cd ${APP_DIR} && npm run db:seed" || true
su - ukaf -c "cd ${APP_DIR} && npm run build"

echo "[8/8] Installing systemd services..."

cat > /etc/systemd/system/ukaf.service <<EOF
[Unit]
Description=UKAF app
After=network.target postgresql.service

[Service]
Type=simple
User=ukaf
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Second copy of the same app, forced into "admin" mode regardless of
# hostname — the simplest way to put admin on its own port/domain without
# depending on DNS/subdomain routing working correctly.
cat > /etc/systemd/system/ukaf-admin.service <<EOF
[Unit]
Description=UKAF admin app
After=network.target postgresql.service

[Service]
Type=simple
User=ukaf
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
Environment=ADMIN_ONLY=true
ExecStart=/usr/bin/npm run start:admin
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# --- Deploy script: git pull -> install -> migrate -> build -> restart ----
mkdir -p /home/ukaf/bin
cat > /home/ukaf/bin/deploy.sh <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd ${APP_DIR}
echo "\$(date -Is) deploying \${1:-${BRANCH}}" >> ${DEPLOY_LOG}
git fetch origin
git reset --hard "origin/${BRANCH}"
npm ci
npx prisma migrate deploy
npm run build
echo "\$(date -Is) deploy complete" >> ${DEPLOY_LOG}
EOF
chown -R ukaf:ukaf /home/ukaf/bin
chmod +x /home/ukaf/bin/deploy.sh
touch "$DEPLOY_LOG" && chown ukaf:ukaf "$DEPLOY_LOG"

# The deploy script needs to restart root-owned systemd units; allow the
# ukaf user to do only that, nothing else.
cat > /etc/sudoers.d/ukaf-deploy <<EOF
ukaf ALL=(root) NOPASSWD: /usr/bin/systemctl restart ukaf, /usr/bin/systemctl restart ukaf-admin
EOF
chmod 440 /etc/sudoers.d/ukaf-deploy

# --- Webhook listener: verifies GitHub's HMAC signature, then deploys -----
cat > /home/ukaf/bin/webhook-server.js <<'EOF'
// Minimal GitHub webhook receiver — no dependencies. Verifies the
// X-Hub-Signature-256 header, then on a push to the configured branch runs
// deploy.sh and restarts the app service.
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET;
const BRANCH = process.env.DEPLOY_BRANCH || 'main';

if (!SECRET) {
  console.error('WEBHOOK_SECRET is not set — refusing to start.');
  process.exit(1);
}

function verify(payload, signature) {
  if (!signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function deploy() {
  console.log(`[${new Date().toISOString()}] deploying...`);
  const proc = spawn('/home/ukaf/bin/deploy.sh', [BRANCH], { stdio: 'inherit' });
  proc.on('exit', (code) => {
    if (code !== 0) {
      console.error(`deploy.sh exited with code ${code} — not restarting the service.`);
      return;
    }
    spawn('sudo', ['/usr/bin/systemctl', 'restart', 'ukaf'], { stdio: 'inherit' });
    spawn('sudo', ['/usr/bin/systemctl', 'restart', 'ukaf-admin'], { stdio: 'inherit' });
  });
}

http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404).end();
    return;
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const signature = req.headers['x-hub-signature-256'];

    if (!verify(body, signature)) {
      res.writeHead(401).end('bad signature');
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body.toString('utf8'));
    } catch {
      res.writeHead(400).end('bad json');
      return;
    }

    const ref = payload.ref; // e.g. "refs/heads/main"
    if (ref !== `refs/heads/${BRANCH}`) {
      res.writeHead(200).end(`ignored (ref ${ref})`);
      return;
    }

    res.writeHead(202).end('deploying');
    deploy();
  });
}).listen(PORT, () => console.log(`webhook listener on :${PORT}, watching branch '${BRANCH}'`));
EOF
chown ukaf:ukaf /home/ukaf/bin/webhook-server.js

cat > /etc/systemd/system/ukaf-webhook.service <<EOF
[Unit]
Description=UKAF GitHub webhook listener (auto-deploy on push)
After=network.target

[Service]
Type=simple
User=ukaf
Environment=WEBHOOK_PORT=${WEBHOOK_PORT}
Environment=WEBHOOK_SECRET=${WEBHOOK_SECRET}
Environment=DEPLOY_BRANCH=${BRANCH}
ExecStart=/usr/bin/node /home/ukaf/bin/webhook-server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now ukaf
systemctl enable --now ukaf-admin
systemctl enable --now ukaf-webhook

echo "Setup complete."
