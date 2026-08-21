package com.photographplatform.api.common.migration;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;

/**
 * Standalone entry point that applies Flyway migrations and exits. Invoked by
 * {@code docker-entrypoint.sh migrate} as a release/pre-deploy step.
 *
 * <h2>Why this exists instead of just enabling Flyway on the app</h2>
 * Booting the application to migrate makes the migration depend on everything
 * <em>else</em> the application needs. That was not theoretical: starting the
 * context with {@code spring.flyway.enabled=true} applied the migration
 * successfully and then failed a few hundred milliseconds later building the
 * JPA {@code EntityManagerFactory}, because the runtime datasource connects as
 * a different role ({@code fotolio_app}) than the one that just migrated. The
 * process exited non-zero <em>after</em> changing the schema — the worst
 * possible outcome for a pre-deploy hook, which reads that as "migration
 * failed" and aborts the rollout against an already-migrated database.
 *
 * <p>The same trap is waiting behind Redis, the email provider's startup
 * validation and the object-store credential check. None of them have anything
 * to do with whether the schema can be brought up to date.
 *
 * <p>So this touches nothing but the database: no Spring context, no JPA, no
 * connection pool. It fails only when a migration actually fails.
 */
public final class FlywayMigrateRunner {

    private FlywayMigrateRunner() {
    }

    public static void main(String[] args) {
        String url = env("FLYWAY_URL");
        String user = env("FLYWAY_USER");
        // Falls back to DB_PASSWORD because the two roles commonly share a
        // password in single-database setups; FLYWAY_PASSWORD wins when set.
        String password = System.getenv("FLYWAY_PASSWORD") != null
            ? System.getenv("FLYWAY_PASSWORD")
            : System.getenv("DB_PASSWORD");

        if (url == null || user == null) {
            System.err.println("FLYWAY_URL and FLYWAY_USER are required. They must name the "
                + "schema-owning role — the runtime role (DB_USERNAME) has no DDL rights.");
            System.exit(1);
        }

        try {
            Flyway flyway = Flyway.configure()
                .dataSource(url, user, password)
                .locations("classpath:db/migration")
                .schemas("public")
                .load();

            MigrateResult result = flyway.migrate();
            if (result.migrationsExecuted == 0) {
                // targetSchemaVersion is null when nothing ran, so report the
                // version actually on the database instead of printing "null".
                System.out.println("Schema already up to date at version "
                    + flyway.info().current().getVersion() + "; nothing to apply.");
            } else {
                System.out.println("Applied " + result.migrationsExecuted
                    + " migration(s); schema now at version " + result.targetSchemaVersion + ".");
            }
        } catch (RuntimeException e) {
            System.err.println("Migration failed: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static String env(String name) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? null : value;
    }
}
