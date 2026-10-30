#!/bin/sh
# Two modes, one image.
#
#   serve     (default) run the API
#   migrate            apply Flyway migrations, then exit
#
# They are separate because they connect as *different database roles*, and
# that split is what makes tenant isolation work. The API runs as the
# least-privilege `fotolio_app` role, which RLS applies to and which has no DDL
# rights at all (see infra/README.md), so it cannot migrate its own schema —
# spring.flyway.enabled is false for exactly that reason. Migration connects as
# the owning role via FLYWAY_URL / FLYWAY_USER / FLYWAY_PASSWORD.
#
# Run `migrate` as a release/pre-deploy step before rolling out `serve`.
set -e

case "${1:-serve}" in
  migrate)
    if [ -z "${FLYWAY_URL}" ] || [ -z "${FLYWAY_USER}" ]; then
      echo "migrate: FLYWAY_URL and FLYWAY_USER must be set (the schema-owning role," >&2
      echo "         not DB_USERNAME — fotolio_app has no DDL rights)." >&2
      exit 1
    fi
    echo "Running Flyway migrations as ${FLYWAY_USER}..."
    # FlywayMigrateRunner, not the application: booting the app to migrate makes
    # the migration depend on JPA, Redis and every other startup check, and an
    # exit code from any of those is indistinguishable from a failed migration.
    # PropertiesLauncher is how a Spring Boot fat jar runs an alternate main.
    exec java ${JAVA_OPTS} \
      -Dloader.main=com.photographplatform.api.common.migration.FlywayMigrateRunner \
      -cp /app/app.jar org.springframework.boot.loader.launch.PropertiesLauncher
    ;;
  serve)
    exec java ${JAVA_OPTS} -jar /app/app.jar
    ;;
  *)
    # Anything else is passed straight through, so `docker run <img> sh` works.
    exec "$@"
    ;;
esac
