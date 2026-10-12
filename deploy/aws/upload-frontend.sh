#!/usr/bin/env bash
# Builds the frontend on this PC and uploads it to the EC2 server (Git Bash on Windows works).
#   deploy/aws/upload-frontend.sh <server-ip> [path/to/key.pem]
# Browser keys are read from frontend/.env.production if present (never set VITE_API_URL there).
set -euo pipefail

HOST="${1:?usage: upload-frontend.sh <server-ip> [key.pem]}"
KEY="${2:-$HOME/.ssh/rs-crm.pem}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "ubuntu@$HOST")

(cd "$ROOT/frontend" && npx vite build)
tar -C "$ROOT/frontend/dist" -czf "$ROOT/frontend/dist.tgz" .
scp -i "$KEY" "$ROOT/frontend/dist.tgz" "ubuntu@$HOST:/tmp/rs-crm-dist.tgz"
rm -f "$ROOT/frontend/dist.tgz"
"${SSH[@]}" 'set -e
  rm -rf /tmp/rs-crm-dist && mkdir /tmp/rs-crm-dist
  tar -xzf /tmp/rs-crm-dist.tgz -C /tmp/rs-crm-dist
  sudo mkdir -p /var/www/rs-crm
  sudo rsync -a --delete /tmp/rs-crm-dist/ /var/www/rs-crm/
  rm -rf /tmp/rs-crm-dist /tmp/rs-crm-dist.tgz'
echo "Frontend live at http://$HOST"
