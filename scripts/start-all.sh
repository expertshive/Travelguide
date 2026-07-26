#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

set -a
source .env
set +a

echo "==> Starting Docker infrastructure..."
pnpm dev:infra
sleep 5

echo "==> Pushing Prisma schemas to MySQL..."
SERVICES=(
  "auth-service:DATABASE_URL_AUTH"
  "user-service:DATABASE_URL_USER"
  "trip-service:DATABASE_URL_TRIP"
  "place-service:DATABASE_URL_PLACE"
  "navigation-service:DATABASE_URL_NAVIGATION"
  "social-service:DATABASE_URL_SOCIAL"
  "chat-service:DATABASE_URL_CHAT"
  "notification-service:DATABASE_URL_NOTIFICATION"
  "media-service:DATABASE_URL_MEDIA"
  "ai-service:DATABASE_URL_AI"
  "payment-service:DATABASE_URL_PAYMENT"
  "business-service:DATABASE_URL_BUSINESS"
)

for entry in "${SERVICES[@]}"; do
  IFS=':' read -r svc var <<< "$entry"
  db_url="${!var}"
  echo "  -> $svc"
  (cd "apps/$svc" && DATABASE_URL="$db_url" pnpm prisma:push --accept-data-loss 2>/dev/null || DATABASE_URL="$db_url" pnpm prisma:push)
done

echo "==> Seeding auth-service..."
(cd apps/auth-service && DATABASE_URL="$DATABASE_URL_AUTH" pnpm prisma:seed)

echo "==> Building shared packages..."
pnpm --filter @traveler-guide/types build
pnpm --filter @traveler-guide/api-client build
pnpm --filter @traveler-guide/validation build

echo "==> Starting services..."
for port in 3000 3002 4000 4001 4002 4003 8081; do
  lsof -ti :$port | xargs kill -9 2>/dev/null || true
done
sleep 2

# macOS has no setsid, so fall back to python to detach into a new session.
# Without a new session the services are killed when the launching shell exits.
if command -v setsid >/dev/null 2>&1; then
  DETACH=(setsid)
else
  DETACH=(python3 -c 'import os,sys; os.setsid(); os.execvp(sys.argv[1], sys.argv[1:])')
fi

start_daemon() {
  local name=$1
  local cmd=$2
  local log="/tmp/tg-$name.log"
  "${DETACH[@]}" bash -c "$cmd" > "$log" 2>&1 < /dev/null &
  disown 2>/dev/null || true
  echo "  started $name (log: $log, pid: $!)"
}

start_daemon api-gateway "cd $ROOT/apps/api-gateway && set -a && source $ROOT/.env && set +a && PORT=4000 pnpm dev"
start_daemon auth-service "cd $ROOT/apps/auth-service && set -a && source $ROOT/.env && set +a && PORT=4001 DATABASE_URL=$DATABASE_URL_AUTH pnpm dev"
start_daemon user-service "cd $ROOT/apps/user-service && set -a && source $ROOT/.env && set +a && PORT=4002 DATABASE_URL=$DATABASE_URL_USER pnpm dev"
start_daemon trip-service "cd $ROOT/apps/trip-service && set -a && source $ROOT/.env && set +a && PORT=4003 DATABASE_URL=$DATABASE_URL_TRIP pnpm dev"
start_daemon web "cd $ROOT/apps/web && PORT=3000 pnpm dev"
start_daemon admin "cd $ROOT/apps/admin && pnpm dev"
start_daemon mobile "cd $ROOT/apps/mobile && pnpm start -- --reset-cache"

sleep 15
echo "==> Health checks..."
curl -sf http://localhost:4000/v1/health && echo " gateway OK" || echo " gateway FAILED"
curl -sf http://localhost:4001/v1/health && echo " auth OK" || echo " auth FAILED"
curl -sf -o /dev/null http://localhost:3000 && echo " web OK" || echo " web FAILED"
curl -sf -o /dev/null http://localhost:3002 && echo " admin OK" || echo " admin FAILED"
curl -sf http://localhost:8081/status && echo " metro OK" || echo " metro FAILED"

echo ""
echo "Done! Open:"
echo "  Web:    http://localhost:3000"
echo "  Admin:  http://localhost:3002/login"
echo "  API:    http://localhost:4000/docs"
echo "  Mobile: cd apps/mobile && pnpm ios"
