#!/usr/bin/env bash
# Installs or updates RS-CRM on an Ubuntu EC2 instance (nginx + pm2 + SQLite).
# First run: installs everything, seeds the DB, prints the admin password.
# Later runs: pull latest main, rebuild, restart. Your .env files and database are kept.
#
#   curl -fsSL https://raw.githubusercontent.com/kd-lxdia/RS-CRM/main/deploy/aws/setup-ec2.sh | bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/kd-lxdia/RS-CRM.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/rs-crm}"
DATA_DIR="${DATA_DIR:-/var/lib/rs-crm}"
WEB_DIR=/var/www/rs-crm
RUN_USER="$(id -un)"

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

if [ "$RUN_USER" = "root" ]; then
  echo "Run this as the normal login user (ubuntu), not root." >&2
  exit 1
fi

# Vite needs more memory than a 1-2 GB instance has; swap keeps the build from being killed.
if ! sudo swapon --show | grep -q /swapfile; then
  log "Adding 4 GB swap"
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

log "Installing system packages"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y git nginx curl ca-certificates sqlite3 openssl rsync
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v pm2 >/dev/null || sudo npm install -g pm2

log "Fetching code ($BRANCH)"
sudo mkdir -p "$APP_DIR" "$DATA_DIR"
sudo chown "$RUN_USER":"$RUN_USER" "$APP_DIR" "$DATA_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# Public origin of this instance, used for CORS and socket.io.
TOKEN="$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' || true)"
PUBLIC_IP="$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 || true)"
ORIGIN="http://${PUBLIC_IP:-localhost}"

if [ ! -f backend/.env ]; then
  log "Creating backend/.env with fresh secrets"
  cat > backend/.env <<EOF
NODE_ENV=production
PORT=4000
DATABASE_URL=file:$DATA_DIR/crm.db
DISABLE_REDIS=true

JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)
INTERNAL_API_KEY=$(openssl rand -hex 32)

# Comma-separated browser origins allowed to call the API. Add your domain here when you have one.
FRONTEND_URL=$ORIGIN
BACKEND_URL=$ORIGIN

# Optional integrations: fill in, then run: pm2 restart rs-crm
GOOGLE_MAPS_API_KEY=
OPENROUTER_API_KEY=
SARVAM_API_KEY=
SARVAM_AI_API_KEY=
BLAND_AI_API_KEY=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
META_WHATSAPP_TOKEN=
META_PHONE_NUMBER_ID=
META_WHATSAPP_APP_SECRET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET_NAME=
AWS_S3_BUCKET=
EOF
  chmod 600 backend/.env
elif [ -n "$PUBLIC_IP" ] && ! grep -q "^FRONTEND_URL=.*$ORIGIN" backend/.env; then
  # The public IP changes when the instance is stopped and started (unless it has an Elastic IP).
  log "Adding $ORIGIN to FRONTEND_URL"
  sed -i "s#^FRONTEND_URL=\(.*\)#FRONTEND_URL=\1,$ORIGIN#" backend/.env
fi

if [ ! -f frontend/.env.production ]; then
  # VITE_API_URL is left unset on purpose: the built app then calls /api on its own origin.
  cat > frontend/.env.production <<EOF
# Browser-side keys (they end up in the public JS). Re-run this script after editing.
VITE_GOOGLE_MAPS_KEY=
VITE_GOOGLE_MAPS_API_KEY=
VITE_MAPBOX_TOKEN=
VITE_MAPBOX_PUBLIC_TOKEN=
EOF
fi

log "Installing npm dependencies"
npm ci --no-audit --no-fund

log "Building shared + backend"
(cd shared && npx tsc)
cd backend
npx prisma generate
# Emit JS without type-checking: full checking runs out of memory on small instances,
# and the backend has known type errors (it runs via ts-node --transpile-only locally).
NODE_OPTIONS=--max-old-space-size=3072 npx tsc --noCheck
test -f dist/index.js
DB_EXISTED=false
[ -f "$DATA_DIR/crm.db" ] && DB_EXISTED=true
npx prisma db push --skip-generate
if [ "$DB_EXISTED" = false ]; then
  SEED_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=')"
  SEED_PASSWORD="$SEED_PASSWORD" npx ts-node --transpile-only prisma/seed.ts
  printf 'Login: admin@slarcrm.com\nPassword (all seeded accounts): %s\n' "$SEED_PASSWORD" > "$HOME/rs-crm-admin-login.txt"
  chmod 600 "$HOME/rs-crm-admin-login.txt"
fi
cd ..

sudo mkdir -p "$WEB_DIR"
MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
if [ "${BUILD_FRONTEND:-auto}" = "yes" ] || { [ "${BUILD_FRONTEND:-auto}" = "auto" ] && [ "$MEM_MB" -ge 3500 ]; }; then
  log "Building frontend (takes a few minutes)"
  (cd frontend && NODE_OPTIONS=--max-old-space-size=3072 npx vite build)
  sudo rsync -a --delete frontend/dist/ "$WEB_DIR/"
else
  # The Vite build thrashes swap for hours on 1-2 GB instances; build it on a PC instead.
  log "Skipping frontend build (${MEM_MB} MB RAM). From your PC run: deploy/aws/upload-frontend.sh"
fi

log "Configuring nginx"
sudo cp deploy/aws/nginx.conf /etc/nginx/sites-available/rs-crm
sudo ln -sf /etc/nginx/sites-available/rs-crm /etc/nginx/sites-enabled/rs-crm
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

log "Starting backend with pm2"
pm2 startOrReload deploy/aws/ecosystem.config.cjs --update-env
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$RUN_USER" --hp "$HOME" >/dev/null

log "Waiting for the API"
for _ in $(seq 1 60); do
  curl -fsS http://127.0.0.1/health >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS http://127.0.0.1/health && echo

log "Done: open $ORIGIN"
if [ "$DB_EXISTED" = false ]; then
  echo "Admin login (also saved in ~/rs-crm-admin-login.txt):"
  cat "$HOME/rs-crm-admin-login.txt"
fi
