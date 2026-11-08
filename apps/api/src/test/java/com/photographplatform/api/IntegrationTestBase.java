package com.photographplatform.api;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.http.io.SocketConfig;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
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
        DELETE FROM gallery_expiry_reminders;
        DELETE FROM delivery_photos;
        DELETE FROM galleries;
        DELETE FROM bookings;
        DELETE FROM studio_resources;
        DELETE FROM clients;
        DELETE FROM packages;
        DELETE FROM leads;
        DELETE FROM categories;
        DELETE FROM photos;
        DELETE FROM inquiry_requests;
        DELETE FROM refresh_tokens;
        DELETE FROM users;
        DELETE FROM tenants;
        DELETE FROM scheduled_job_locks;
        """;

    @BeforeEach
    void resetDatabase() throws Exception {
        try (Connection conn = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             Statement stmt = conn.createStatement()) {
            stmt.execute(CLEANUP_SQL);
        }
    }

    /**
     * Counts rows as the container superuser, so the query sees every tenant.
     *
     * <p>Needed because the application role is bound to one tenant per
     * transaction by RLS — which is exactly why a cross-tenant duplicate can
     * exist for a long time without any application query noticing it. A test
     * asserting on that shape has to look from outside the isolation boundary.
     *
     * @param sql a query returning a single numeric column
     */
    protected long countAcrossTenants(String sql, Object... params) {
        try (Connection conn = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                ps.setObject(i + 1, params[i]);
            }
            try (ResultSet rs = ps.executeQuery()) {
                rs.next();
                return rs.getLong(1);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Cross-tenant count failed: " + sql, e);
        }
    }

    /** Reads one value as the container superuser, so it sees every tenant. */
    protected String valueAcrossTenants(String sql, Object... params) {
        try (Connection conn = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                ps.setObject(i + 1, params[i]);
            }
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getString(1) : null;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Cross-tenant read failed: " + sql, e);
        }
    }

    /**
     * Runs a statement as the container superuser — for arranging data in
     * several tenants at once, which the application role cannot do by design.
     */
    protected void executeAcrossTenants(String sql, Object... params) {
        try (Connection conn = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
             PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                ps.setObject(i + 1, params[i]);
            }
            ps.execute();
        } catch (SQLException e) {
            throw new IllegalStateException("Cross-tenant statement failed: " + sql, e);
        }
    }

    /**
     * The {@link TestRestTemplate} instances already stripped of their retry
     * behaviour, by identity: one per cached application context, swapped once
     * rather than on every test method so each context keeps a single
     * connection pool.
     */
    private static final Set<TestRestTemplate> RETRIES_DISABLED =
        Collections.synchronizedSet(Collections.newSetFromMap(new IdentityHashMap<>()));

    @Autowired(required = false)
    private TestRestTemplate testRestTemplate;

    @Value("${spring.http.client.read-timeout:10s}")
    private Duration testClientReadTimeout;

    /**
     * Stops the test HTTP client from retrying, and from sleeping for the
     * duration a 429 asks for.
     *
     * <p>Apache HttpClient5 is on the test classpath (transitively, via
     * stripe-java), so {@code TestRestTemplate} sends its requests through it.
     * Its default {@code DefaultHttpRequestRetryStrategy} retries once — and
     * on a 429 or 503 it waits for exactly as long as the response's
     * {@code Retry-After} header names. The rate-limit tests here answer
     * {@code Retry-After: 900}, so a client that had already received the
     * response the assertion wanted then slept for fifteen minutes before
     * re-sending a request that could only be refused again.
     *
     * <p>That is why no {@code *IT} class has ever produced a surefire report
     * in this repository: {@code AuthControllerIT} alone parks a run for
     * roughly forty minutes (300 + 300 + 900 + 900 seconds), so every full
     * local run was killed before reaching the integration tests.
     *
     * <p>The header is correct — it is what a real client should read — so the
     * fix belongs on the test client, not on the rate limiter. Nothing about
     * what is asserted changes: a test client wants the first response, never
     * a second attempt at it.
     *
     * <p>Only the {@code HttpClient} is replaced. Cookie policy, redirect
     * handling and authentication live in the {@code RequestConfig} that
     * {@code TestRestTemplate}'s own request factory re-applies to every
     * request in {@code createHttpContext}, so the semantics these tests were
     * written against are untouched. The socket timeout is rebuilt from the
     * same property Spring Boot used, so a server that stops answering still
     * fails the test instead of hanging it.
     */
    @BeforeEach
    void disableTestClientRetries() {
        if (testRestTemplate == null || !RETRIES_DISABLED.add(testRestTemplate)) {
            return;
        }
        ClientHttpRequestFactory factory = testRestTemplate.getRestTemplate().getRequestFactory();
        if (factory instanceof HttpComponentsClientHttpRequestFactory httpComponents) {
            SocketConfig socketConfig = SocketConfig.custom()
                .setSoTimeout((int) testClientReadTimeout.toMillis(), TimeUnit.MILLISECONDS)
                .build();
            httpComponents.setHttpClient(HttpClients.custom()
                .setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create()
                    .setDefaultSocketConfig(socketConfig)
                    .build())
                .disableAutomaticRetries()
                .build());
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
