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

    static {
        postgres.start();
    }

    /**
     * Point both the application datasource ({@code spring.datasource.*}, used by
     * the hand-built pool in {@code DataSourceConfig}) and Flyway at the shared
     * container. Without this the app datasource silently falls back to embedded
     * H2 while Flyway migrates Postgres.
     */
    @DynamicPropertySource
    static void containerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", postgres::getUsername);
        registry.add("spring.flyway.password", postgres::getPassword);
    }

    /**
     * Resets the database to a clean slate before each test method.
     *
     * <p>Run programmatically over a raw JDBC connection rather than via
     * {@code @Sql}: the script contains a PL/pgSQL {@code DO $$ ... $$} block,
     * and Spring's {@code @Sql} statement splitter does not understand dollar
     * quoting — it splits on the first {@code ;} inside the block. The Postgres
     * driver parses the dollar quote server-side, so a single {@code execute()}
     * handles the whole script correctly.
     */
    private static final String CLEANUP_SQL = """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN
                SELECT schema_name
                FROM information_schema.schemata
                WHERE schema_name LIKE 'tenant_%'
            LOOP
                EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(r.schema_name) || ' CASCADE';
            END LOOP;
        END;
        $$;
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
