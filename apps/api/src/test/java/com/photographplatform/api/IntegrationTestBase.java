package com.photographplatform.api;

import java.util.List;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
public abstract class IntegrationTestBase {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

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
