#!/usr/bin/env bash
#
# The infrastructure an agent run needs before it can start the app: Postgres,
# Redis, MinIO and Mailpit from infra/docker-compose.yml, with every Flyway
# migration applied. The factory workflows run it before the agent starts.
#
# The checks do not need it: `mvn verify` brings its own Postgres through
# Testcontainers, and the web tests mock the API. It is here so the agent can
# run the app itself, with ./scripts/e2e-stack.sh up, when a ticket changes
# something it has to see.
#
# Migrations run the way a deploy runs them, through FlywayMigrateRunner as
# the schema-owning role, because the app's own role has no DDL rights. Not
# seeded: scripts/seed-demo.sql fills an existing tenant, and a fresh database
# has none until someone registers one.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "$ROOT/infra/docker-compose.yml")

echo "==> infrastructure"
"${COMPOSE[@]}" up -d --wait postgres redis mailpit minio
# A one-shot that creates the media bucket. Without it every upload fails.
"${COMPOSE[@]}" up minio-init

echo "==> API jar"
# e2e-stack.sh runs this same jar, so building it here is not wasted.
(cd "$ROOT/apps/api" && mvn -B -q package -DskipTests)

echo "==> migrations"
FLYWAY_URL="jdbc:postgresql://localhost:5433/centralidp" \
  FLYWAY_USER="postgres" \
  FLYWAY_PASSWORD="postgres" \
  java \
  -Dloader.main=com.photographplatform.api.common.migration.FlywayMigrateRunner \
  -cp "$ROOT/apps/api/target/api-0.0.1-SNAPSHOT.jar" \
  org.springframework.boot.loader.launch.PropertiesLauncher

echo "infrastructure ready: Postgres localhost:5433, Redis :6379, MinIO :9000, Mailpit :8025"
