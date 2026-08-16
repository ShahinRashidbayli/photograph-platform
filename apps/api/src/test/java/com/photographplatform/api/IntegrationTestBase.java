package com.photographplatform.api;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public abstract class IntegrationTestBase {

    /**
     * Singleton container — started once on class load and shared by every
     * integration test in the JVM. The {@code @Container}/{@code @Testcontainers}
     * lifecycle would stop the container after each test class; the next class
     * reusing a cached Spring context would then hold a connection pool pointing
     * at a dead port. Starting once (Ryuk reaps it at JVM exit) avoids that.
     */
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final String APP_ROLE = "fotolio_app";
    private static final String APP_ROLE_PASSWORD = "fotolio_app_test_password";

    static {
        postgres.start();
        createAppRole();
    }

    /**
     * {@code fotolio_app} is normally created by {@code V11__tenant_rls.sql},
     * but Flyway runs after this static initializer in test bootstrap order,
     * so it's created once here instead, with the Testcontainers superuser —
     * idempotent, matching the migration's own {@code IF NOT EXISTS} guard.
     */
    private static void createAppRole() {
        try (Connection conn = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement stmt = conn.createStatement()) {
            stmt.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '%s') THEN
                        CREATE ROLE %s LOGIN PASSWORD '%s';
                    END IF;
                END
                $$;
                """.formatted(APP_ROLE, APP_ROLE, APP_ROLE_PASSWORD));
        } catch (Exception e) {
            throw new IllegalStateException("Failed to create " + APP_ROLE + " role", e);
        }
    }

    /**
     * The application datasource ({@code spring.datasource.*}, used by the
     * hand-built pool in {@code DataSourceConfig}) connects as the
     * least-privilege {@code fotolio_app} role — the same split as
     * production (DB_USERNAME vs FLYWAY_USER) — so RLS is actually exercised
     * by these tests rather than silently bypassed by a superuser connection.
     * Flyway keeps using the Testcontainers superuser to run migrations
     * (including the {@code CREATE ROLE} in V11) and grant it privileges.
     */
    @DynamicPropertySource
    static void containerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", () -> APP_ROLE);
        registry.add("spring.datasource.password", () -> APP_ROLE_PASSWORD);
        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", postgres::getUsername);
        registry.add("spring.flyway.password", postgres::getPassword);
    }

    /**
     * Resets the database to a clean slate before each test method.
     *
     * <p>Run with the Testcontainers superuser (not {@code fotolio_app}) so it
     * can wipe every tenant's rows in one go regardless of RLS — a request
     * scoped to one tenant could never see, let alone delete, another
     * tenant's data over a single connection. Tables are deleted leaf-to-root
     * to respect FKs without relying on {@code ON DELETE CASCADE} side effects.
     *
     * <p>The invoice tables are {@code TRUNCATE}d, not {@code DELETE}d: {@code
     * trg_invoices_immutable}/{@code trg_invoice_line_items_immutable} (see
     * V13) reject every {@code DELETE}, GoBD-style, and that block applies to
     * every role including the superuser — triggers aren't an RLS feature, so
     * FORCE ROW LEVEL SECURITY doesn't exempt this connection from them.
     * {@code TRUNCATE} only fires statement-level {@code BEFORE/AFTER
     * TRUNCATE} triggers, which these tables don't have, so it bypasses the
     * row-level block entirely. Listing every table in one statement lets
     * Postgres resolve the self-referential {@code storno_of_id} FK and the
     * {@code invoice_line_items}/{@code payments -> invoices} FKs without
     * needing {@code CASCADE} or a specific order.
     */
    private static final String CLEANUP_SQL = """
        TRUNCATE payments, processed_stripe_events, invoice_line_items, invoices, invoice_counters;
        DELETE FROM delivery_photos;
        DELETE FROM galleries;
        DELETE FROM bookings;
        DELETE FROM clients;
        DELETE FROM packages;
        DELETE FROM leads;
        DELETE FROM categories;
        DELETE FROM photos;
        DELETE FROM inquiry_requests;
        DELETE FROM refresh_tokens;
        DELETE FROM users;
        DELETE FROM tenants;
        """;

    @BeforeEach
    void resetDatabase() throws Exception {
        try (Connection conn = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement stmt = conn.createStatement()) {
            stmt.execute(CLEANUP_SQL);
        }
    }

    @MockitoBean
    protected StringRedisTemplate redisTemplate;

    @SuppressWarnings("unchecked")
    protected void mockRedisNoLock() {
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redisTemplate.hasKey(anyString())).thenReturn(false);
        when(redisTemplate.opsForValue()).thenReturn(ops);
        when(ops.increment(anyString())).thenReturn(1L);
        when(redisTemplate.expire(anyString(), any())).thenReturn(true);
    }

    /**
     * Extracts the value of a Set-Cookie header by cookie name. Tokens are no
     * longer returned in the JSON body — they live in httpOnly cookies, so tests
     * must read them from the response headers.
     */
    protected String extractCookie(ResponseEntity<?> response, String cookieName) {
        List<String> setCookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
        if (setCookies == null) {
            return null;
        }
        String prefix = cookieName + "=";
        for (String header : setCookies) {
            if (header.startsWith(prefix)) {
                int end = header.indexOf(';');
                String value = end == -1 ? header.substring(prefix.length()) : header.substring(prefix.length(), end);
                return value.isEmpty() ? null : value;
            }
        }
        return null;
    }
}
