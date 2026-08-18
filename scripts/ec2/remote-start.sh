#!/usr/bin/env bash
# Start infra + Nest services + Caddy on the EC2 box. No web/admin/Metro.
set -euo pipefail

ROOT="${ROOT:-$HOME/Travelguide}"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing $ROOT/.env — copy it from your Mac before starting."
  exit 1
fi

set -a
# Keep OTP 0000 and local-style keys so the phone can test.
# shellcheck disable=SC1091
source .env
NODE_ENV="${NODE_ENV:-development}"
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=192}"
set +a

SERVICES=(
  "auth-service:4001:DATABASE_URL_AUTH"
  "user-service:4002:DATABASE_URL_USER"
  "trip-service:4003:DATABASE_URL_TRIP"
  "place-service:4004:DATABASE_URL_PLACE"
  "navigation-service:4005:DATABASE_URL_NAVIGATION"
  "social-service:4006:DATABASE_URL_SOCIAL"
  "chat-service:4007:DATABASE_URL_CHAT"
  "notification-service:4008:DATABASE_URL_NOTIFICATION"
  "media-service:4009:DATABASE_URL_MEDIA"
  "ai-service:4010:DATABASE_URL_AI"
  "payment-service:4011:DATABASE_URL_PAYMENT"
  "business-service:4012:DATABASE_URL_BUSINESS"
  "map-service:4013:DATABASE_URL_MAP"
)

PUBLIC_IP="$(curl -fsS --max-time 3 http://169.254.169.254/latest/meta-data/public-ipv4 || true)"
if [[ -z "$PUBLIC_IP" ]]; then
  PUBLIC_IP="$(curl -fsS --max-time 8 https://checkip.amazonaws.com | tr -d '[:space:]')"
fi
DOMAIN="${PUBLIC_IP//./-}.sslip.io"
export DOMAIN

echo "==> Public API will be https://${DOMAIN}/v1"

echo "==> Docker infra"
docker compose -f infrastructure/ec2/docker-compose.infra.yml up -d

echo "==> Waiting for MySQL"
for i in $(seq 1 30); do
  if docker exec traveler-mysql mysqladmin ping -h localhost -uroot -prootpassword --silent 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "==> Install JS deps (backend only, to fit 8G disk)"
pnpm install \
  --filter @traveler-guide/api-gateway \
  --filter @traveler-guide/auth-service \
  --filter @traveler-guide/user-service \
  --filter @traveler-guide/trip-service \
  --filter @traveler-guide/place-service \
  --filter @traveler-guide/navigation-service \
  --filter @traveler-guide/social-service \
  --filter @traveler-guide/chat-service \
  --filter @traveler-guide/notification-service \
  --filter @traveler-guide/media-service \
  --filter @traveler-guide/ai-service \
  --filter @traveler-guide/payment-service \
  --filter @traveler-guide/business-service \
  --filter @traveler-guide/map-service \
  --filter @traveler-guide/types \
  --filter @traveler-guide/db-admin \
  --filter @traveler-guide/integrations \
  --filter @traveler-guide/api-client \
  --filter @traveler-guide/validation \
  --filter @traveler-guide/config \
  --filter @traveler-guide/contracts \
  --filter @traveler-guide/logger

echo "==> Prisma push"
for entry in "${SERVICES[@]}"; do
  IFS=':' read -r svc _port var <<< "$entry"
  db_url="${!var}"
  echo "  -> $svc"
  (cd "apps/$svc" && DATABASE_URL="$db_url" pnpm prisma:push --accept-data-loss 2>/dev/null || DATABASE_URL="$db_url" pnpm prisma:push)
done

echo "==> Seed auth"
(cd apps/auth-service && DATABASE_URL="$DATABASE_URL_AUTH" pnpm prisma:seed)

echo "==> Build shared packages"
pnpm --filter @traveler-guide/logger build
pnpm --filter @traveler-guide/config build
pnpm --filter @traveler-guide/contracts build
pnpm --filter @traveler-guide/types build
pnpm --filter @traveler-guide/db-admin build
pnpm --filter @traveler-guide/integrations build
pnpm --filter @traveler-guide/api-client build
pnpm --filter @traveler-guide/validation build

echo "==> Stop previous Node listeners"
for port in 4000 4001 4002 4003 4004 4005 4006 4007 4008 4009 4010 4011 4012 4013; do
  fuser -k "${port}/tcp" 2>/dev/null || true
done
sleep 2

start_daemon() {
  local name=$1
  local cmd=$2
  local log="/tmp/tg-$name.log"
  setsid bash -c "$cmd" >"$log" 2>&1 </dev/null &
  disown 2>/dev/null || true
  echo "  started $name (log: $log, pid: $!)"
}

export NODE_OPTIONS
echo "==> Build Nest apps (one at a time so t2.medium does not freeze)"
(cd "$ROOT/apps/api-gateway" && pnpm build)
for entry in "${SERVICES[@]}"; do
  IFS=':' read -r svc _port _var <<< "$entry"
  echo "  build $svc"
  (cd "$ROOT/apps/$svc" && pnpm build)
done

echo "==> Starting Nest services"
start_daemon api-gateway "cd $ROOT/apps/api-gateway && set -a && source $ROOT/.env && set +a && PORT=4000 NODE_ENV=$NODE_ENV NODE_OPTIONS='$NODE_OPTIONS' node dist/main"

for entry in "${SERVICES[@]}"; do
  IFS=':' read -r svc port var <<< "$entry"
  start_daemon "$svc" "cd $ROOT/apps/$svc && set -a && source $ROOT/.env && set +a && PORT=$port DATABASE_URL=${!var} NODE_ENV=$NODE_ENV NODE_OPTIONS='$NODE_OPTIONS' node dist/main"
done

echo "==> Caddy (HTTPS)"
DOMAIN="$DOMAIN" docker compose -f infrastructure/ec2/docker-compose.caddy.yml up -d

echo "==> Waiting for gateway"
ok=0
for i in $(seq 1 40); do
  if curl -sf --max-time 3 http://127.0.0.1:4000/v1/health >/dev/null; then
    ok=1
    break
  fi
  sleep 3
done

echo "==> Health"
if [[ "$ok" -eq 1 ]]; then
  echo "  api-gateway OK"
else
  echo "  api-gateway FAILED — see /tmp/tg-api-gateway.log"
fi
for entry in "${SERVICES[@]}"; do
  IFS=':' read -r svc port _var <<< "$entry"
  if curl -sf --max-time 3 "http://127.0.0.1:${port}/v1/health" >/dev/null; then
    printf "  %-22s OK\n" "$svc"
  else
    printf "  %-22s FAILED (/tmp/tg-%s.log)\n" "$svc" "$svc"
  fi
done

echo ""
echo "Public URL:  https://${DOMAIN}/v1/health"
echo "Set apps/mobile/src/config.ts API_PUBLIC_BASE to:"
echo "  https://${DOMAIN}/v1"
echo "$DOMAIN" > /tmp/tg-public-domain.txt
