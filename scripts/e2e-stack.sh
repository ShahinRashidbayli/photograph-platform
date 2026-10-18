#!/usr/bin/env bash
#
# Brings up a disposable stack for the end-to-end tests, on its own ports.
#
# Deliberately not the ports `make dev` uses. A developer running these should
# not have to stop the server they were working in, and an E2E run that wipes
# the database someone was looking at is a tool people stop using. The API
# listens on 8081 and the web server on 3001; both talk to the same Docker
# infrastructure `make infra` already provides.
#
#     ./scripts/e2e-stack.sh up      # build, migrate, start, wait for health
#     ./scripts/e2e-stack.sh down    # stop what it started
#
# The web server is a production build, not `next dev`: the /api rewrite is
# baked in at build time, so the only way to point the browser at this API is
# to build with API_BASE_URL set. That is also what the container does, which
# makes this the same shape as production rather than a test-only arrangement.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT=8081
WEB_PORT=3001
RUN_DIR="$ROOT/.e2e-run"
JAVA_HOME_21="$(/usr/libexec/java_home -v "$(cat "$ROOT/.java-version")" 2>/dev/null || echo "${JAVA_HOME:-}")"

# Email goes to Mailpit over SMTP, because one flow reads a sign-in code out of
# the mailbox — the code only reaches a customer if the message is really built
# and sent, and that path has been wrong here before.
api_env() {
  export DB_URL="jdbc:postgresql://localhost:5433/centralidp"
  export DB_USERNAME="fotolio_app"
  export DB_PASSWORD="fotolio_app_dev_password"
  export FLYWAY_URL="$DB_URL"
  export FLYWAY_USER="postgres"
  export FLYWAY_PASSWORD="postgres"
  export REDIS_HOST=localhost
  export REDIS_PORT=6379
  # A Redis database of its own. Everything the API keeps there — rate-limit
  # counters above all — is keyed by client IP, and every request in a run
  # comes from localhost, so the production limits (5 sign-ups an hour, 3
  # public requests per 5 minutes) trip on the second run. The Playwright
  # global setup empties this database before each run; the dev server's
  # counters in database 0 are never touched.
  export SPRING_DATA_REDIS_DATABASE=15
  export JWT_SECRET="ZTJlLXRlc3Qtc2VjcmV0LWtleS1ub3QtYS1yZWFsLW9uZS0zMjAtYml0cy1sb25n"
  export SERVER_PORT="$API_PORT"
  export APP_WEB_BASE_URL="http://localhost:$WEB_PORT"
  export CORS_ALLOWED_ORIGINS="http://localhost:$WEB_PORT"
  export EMAIL_PROVIDER=smtp
  export SPRING_MAIL_HOST=localhost
  export SPRING_MAIL_PORT=1025
  export EMAIL_FROM="e2e@fotolio.test"
  # Verification is a flow of its own, not a precondition for the four under
  # test; enforcing it here would make every test start by reading a mailbox.
  export APP_EMAIL_VERIFICATION_ENFORCED=false
}

wait_for() {
  local url="$1" name="$2" tries="${3:-120}"
  for _ in $(seq 1 "$tries"); do
    if curl -sf -o /dev/null "$url"; then echo "  $name is up"; return 0; fi
    sleep 1
  done
  echo "  $name did not come up: $url" >&2
  return 1
}

up() {
  mkdir -p "$RUN_DIR"

  echo "==> infrastructure"
  # Redis holds nothing but rate-limit counters here, so any Redis on 6379
  # will do — and one is often already running (a local install, another
  # project's container), in which case starting ours fails on the port.
  local services="postgres mailpit minio"
  if ! printf 'PING\r\n' | nc -w 1 localhost 6379 2>/dev/null | grep -q PONG; then
    services="$services redis"
  fi
  # shellcheck disable=SC2086
  docker compose -f "$ROOT/infra/docker-compose.yml" up -d $services
  docker compose -f "$ROOT/infra/docker-compose.yml" up minio-init >/dev/null
  wait_for "http://localhost:8025" "mailpit"

  echo "==> API"
  api_env
  ( cd "$ROOT/apps/api" && JAVA_HOME="$JAVA_HOME_21" mvn -B -q package -DskipTests )
  JAVA_HOME="$JAVA_HOME_21" nohup "$JAVA_HOME_21/bin/java" \
    -jar "$ROOT/apps/api/target/api-0.0.1-SNAPSHOT.jar" \
    > "$RUN_DIR/api.log" 2>&1 &
  echo $! > "$RUN_DIR/api.pid"
  wait_for "http://localhost:$API_PORT/actuator/health" "api"

  echo "==> web (production build)"
  ( cd "$ROOT/apps/web" \
      && API_BASE_URL="http://localhost:$API_PORT" NEXT_DIST_DIR=.next-e2e npx next build >/dev/null )
  ( cd "$ROOT/apps/web" \
      && NEXT_DIST_DIR=.next-e2e nohup npx next start -p "$WEB_PORT" > "$RUN_DIR/web.log" 2>&1 & \
      echo $! > "$RUN_DIR/web.pid" )
  wait_for "http://localhost:$WEB_PORT/login" "web"

  echo "stack ready — web http://localhost:$WEB_PORT, api http://localhost:$API_PORT"
}

down() {
  for name in api web; do
    if [ -f "$RUN_DIR/$name.pid" ]; then
      kill "$(cat "$RUN_DIR/$name.pid")" 2>/dev/null || true
      rm -f "$RUN_DIR/$name.pid"
    fi
  done
  # Belt and braces: the pid file only knows the process it started.
  lsof -ti:$API_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:$WEB_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
  echo "stack stopped"
}

case "${1:-up}" in
  up) up ;;
  down) down ;;
  *) echo "usage: $0 [up|down]" >&2; exit 2 ;;
esac
