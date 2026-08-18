#!/usr/bin/env bash
# Copy this repo + .env to an Amazon Linux EC2 box and start the API.
#
# Usage (from your Mac, after the instance is running):
#   bash scripts/deploy-ec2.sh -i ~/Downloads/tracking-app.pem -h 54.x.x.x
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY=""
HOST=""
USER="ec2-user"
REMOTE_DIR="Travelguide"

usage() {
  echo "Usage: bash scripts/deploy-ec2.sh -i /path/to/key.pem -h <public-ip-or-dns>"
  exit 1
}

while getopts "i:h:u:" opt; do
  case "$opt" in
    i) KEY="$OPTARG" ;;
    h) HOST="$OPTARG" ;;
    u) USER="$OPTARG" ;;
    *) usage ;;
  esac
done

[[ -n "$KEY" && -n "$HOST" ]] || usage
[[ -f "$KEY" ]] || { echo "Key not found: $KEY"; exit 1; }
[[ -f "$ROOT/.env" ]] || { echo "Missing $ROOT/.env"; exit 1; }

chmod 400 "$KEY"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes "${USER}@${HOST}")
RSYNC=(rsync -az --delete
  -e "ssh -i $KEY -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes"
  --exclude node_modules
  --exclude .git
  --exclude .turbo
  --exclude dist
  --exclude build
  --exclude .next
  --exclude coverage
  --exclude 'apps/mobile'
  --exclude 'apps/web'
  --exclude 'apps/admin'
  --exclude 'src/generated'
  --exclude 'postman'
  --exclude '.claude'
  --exclude '*.pptx'
  --exclude '*.log'
)

echo "==> Waiting for SSH on ${HOST}"
for i in $(seq 1 30); do
  if "${SSH[@]}" 'echo ok' >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

echo "==> Sync code to ${USER}@${HOST}:~/${REMOTE_DIR}"
"${RSYNC[@]}" "$ROOT/" "${USER}@${HOST}:~/${REMOTE_DIR}/"

echo "==> Remote setup"
"${SSH[@]}" "bash ~/${REMOTE_DIR}/scripts/ec2/remote-setup.sh"

echo "==> Remote start (new docker group session)"
"${SSH[@]}" "sg docker -c 'bash ~/${REMOTE_DIR}/scripts/ec2/remote-start.sh'"

echo ""
echo "If docker group is not active yet, SSH in once and re-run:"
echo "  ssh -i $KEY ${USER}@${HOST}"
echo "  bash ~/${REMOTE_DIR}/scripts/ec2/remote-start.sh"
