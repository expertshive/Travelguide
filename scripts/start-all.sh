#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

set -a
source .env
set +a

# service : port : env var holding its database URL
# Every service is listed once and drives schema push, startup and health checks,
# so adding a service means editing this table and nothing else.
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

echo "==> Starting Docker infrastructure..."
pnpm dev:infra
sleep 5

echo "==> Pushing Prisma schemas to MySQL..."
for entry in "${SERVICES[@]}"; do
  IFS=':' read -r svc _port var <<< "$entry"
  db_url="${!var}"
  echo "  -> $svc"
  (cd "apps/$svc" && DATABASE_URL="$db_url" pnpm prisma:push --accept-data-loss 2>/dev/null || DATABASE_URL="$db_url" pnpm prisma:push)
done

echo "==> Seeding auth-service..."
(cd apps/auth-service && DATABASE_URL="$DATABASE_URL_AUTH" pnpm prisma:seed)

echo "==> Building shared packages..."
# types first: db-admin, integrations and api-client all compile against it.
pnpm --filter @traveler-guide/types build
pnpm --filter @traveler-guide/db-admin build
pnpm --filter @traveler-guide/integrations build
pnpm --filter @traveler-guide/api-client build
pnpm --filter @traveler-guide/validation build

echo "==> Freeing ports..."
for port in 3000 3002 4000 4001 4002 4003 4004 4005 4006 4007 4008 4009 4010 4011 4012 4013 8081; do
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

echo "==> Starting services..."
start_daemon api-gateway "cd $ROOT/apps/api-gateway && set -a && source $ROOT/.env && set +a && PORT=4000 pnpm dev"

for entry in "${SERVICES[@]}"; do
  IFS=':' read -r svc port var <<< "$entry"
  # PORT and DATABASE_URL are set after sourcing .env so they win over anything
  # inherited from the launching shell.
  start_daemon "$svc" "cd $ROOT/apps/$svc && set -a && source $ROOT/.env && set +a && PORT=$port DATABASE_URL=${!var} pnpm dev"
done

start_daemon web "cd $ROOT/apps/web && PORT=3000 pnpm dev"
start_daemon admin "cd $ROOT/apps/admin && pnpm dev"
start_daemon mobile "cd $ROOT/apps/mobile && pnpm start -- --reset-cache"

echo "==> Waiting for services to come up..."
sleep 25

echo "==> Health checks..."
check() {
  if curl -sf -o /dev/null --max-time 5 "$2"; then
    printf "  %-22s OK\n" "$1"
  else
    printf "  %-22s FAILED (see /tmp/tg-%s.log)\n" "$1" "$1"
  fi
}

check api-gateway http://localhost:4000/v1/health
for entry in "${SERVICES[@]}"; do
  IFS=':' read -r svc port _var <<< "$entry"
  check "$svc" "http://localhost:$port/v1/health"
done
check web http://localhost:3000
check admin http://localhost:3002
check mobile http://localhost:8081/status

echo ""
echo "Done! Open:"
echo "  Web:          http://localhost:3000"
echo "  Admin:        http://localhost:3002/login"
echo "  Integrations: http://localhost:3002/integrations"
echo "  API docs:     http://localhost:4000/docs"
echo "  Map docs:     http://localhost:4013/docs"
echo "  Mobile:       cd apps/mobile && pnpm ios"
