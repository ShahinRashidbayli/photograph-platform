package com.photographplatform.api.common.migration;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.util.Comparator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Refuses to start against a database the code is newer than.
 *
 * <h2>Why this is not paranoia</h2>
 * {@code spring.flyway.enabled} is {@code false} here, deliberately: the
 * runtime role has no DDL rights and migrations run as a separate release step
 * ({@code docker-entrypoint.sh migrate}). Railway's {@code preDeployCommand}
 * makes that ordering reliable <em>on Railway</em>. Nothing enforces it anywhere
 * else — and when it does not happen, the application boots perfectly, answers
 * {@code /actuator/health} with UP, and then 500s only on the endpoints that
 * touch the missing column.
 *
 * <p>That is not hypothetical. During the audit this happened on a developer
 * machine: the database sat at V19 while the code expected V22, and the app
 * started clean. The health probe cannot see it, so a deploy in that state is
 * reported as successful.
 *
 * <h2>Behind fails, ahead does not</h2>
 * Only a database <em>behind</em> the code is an error. Ahead is the normal
 * state of a rolling deploy — migrations run first, and the previous version's
 * instances keep serving against the new schema until they are replaced. Making
 * that fail would break the deployment strategy it is meant to protect.
 */
@Component
public class SchemaVersionCheck {

    private static final Logger LOG = LoggerFactory.getLogger(SchemaVersionCheck.class);

    /** Matches {@code V23__staff_email_uniqueness.sql} and friends. */
    private static final Pattern MIGRATION = Pattern.compile("^V(\\d+)__.*\\.sql$");

    private final JdbcTemplate jdbc;

    public SchemaVersionCheck(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Runs during bean initialisation, so a mismatch stops the context before
     * the web server accepts a single request. An {@code ApplicationRunner}
     * would be tidier to read but fires after Tomcat is already listening.
     */
    @PostConstruct
    void verify() {
        int expected = highestBundledMigration();
        if (expected == 0) {
            LOG.warn("No migrations found on the classpath — skipping the schema version check");
            return;
        }

        Integer applied;
        try {
            applied = jdbc.queryForObject(
                "SELECT MAX(CAST(version AS INTEGER)) FROM flyway_schema_history WHERE success",
                Integer.class);
        } catch (RuntimeException ex) {
            // No history table, or a database that cannot answer. Both are
            // real problems, but neither is this check's to diagnose — and
            // refusing to start over a failed *diagnostic* would turn a
            // safety net into an outage.
            LOG.warn("Could not read flyway_schema_history; skipping the schema version check", ex);
            return;
        }

        if (applied == null) {
            LOG.warn("flyway_schema_history is empty — skipping the schema version check");
            return;
        }
        if (applied < expected) {
            throw new IllegalStateException(String.format(
                "Database schema is at V%d but this build expects V%d. "
                    + "The migration step did not run, or did not finish. "
                    + "Run `docker-entrypoint.sh migrate` (as the schema-owning role) "
                    + "before starting the application — booting now would serve "
                    + "500s from every endpoint touching the missing columns.",
                applied, expected));
        }
        if (applied > expected) {
            // Normal mid-rollout: migrations ran, this instance is the old
            // version still being drained. Worth a line, not a failure.
            LOG.info("Database schema is at V{} and this build expects V{} — "
                + "newer database, which is expected during a rolling deploy", applied, expected);
            return;
        }
        LOG.info("Database schema is at V{}, matching this build", applied);
    }

    private int highestBundledMigration() {
        try {
            Resource[] found = new PathMatchingResourcePatternResolver()
                .getResources("classpath*:db/migration/V*__*.sql");
            return java.util.Arrays.stream(found)
                .map(Resource::getFilename)
                .filter(java.util.Objects::nonNull)
                .map(MIGRATION::matcher)
                .filter(Matcher::matches)
                .map(m -> Integer.parseInt(m.group(1)))
                .max(Comparator.naturalOrder())
                .orElse(0);
        } catch (IOException ex) {
            LOG.warn("Could not enumerate bundled migrations; skipping the schema version check", ex);
            return 0;
        }
    }
}
