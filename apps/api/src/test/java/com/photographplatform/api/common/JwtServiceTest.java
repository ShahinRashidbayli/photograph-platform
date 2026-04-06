package com.photographplatform.api.common;

import com.photographplatform.api.common.security.JwtService;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final String SECRET =
        "dGVzdC1zZWNyZXQta2V5LWZvci10ZXN0cy1vbmx5LW11c3QtYmUtYXQtbGVhc3QtMjU2LWJpdHM=";

    private final JwtService jwtService = new JwtService(SECRET, 86400000L);

    @Test
    void generateAndValidate() {
        UUID userId = UUID.randomUUID();
        UUID tenantId = UUID.randomUUID();

        String token = jwtService.generateToken(userId, tenantId, "OWNER");
        var claims = jwtService.validateToken(token);

        assertThat(claims).isPresent();
        var c = claims.orElseThrow();
        assertThat(c.getSubject()).isEqualTo(userId.toString());
        assertThat(c.get("tenant_id", String.class)).isEqualTo(tenantId.toString());
        assertThat(c.get("role", String.class)).isEqualTo("OWNER");
    }

    @Test
    void expiredTokenReturnsEmpty() {
        JwtService shortLived = new JwtService(SECRET, -1L);
        String token = shortLived.generateToken(UUID.randomUUID(), UUID.randomUUID(), "OWNER");
        assertThat(jwtService.validateToken(token)).isEmpty();
    }

    @Test
    void invalidTokenReturnsEmpty() {
        assertThat(jwtService.validateToken("not.a.token")).isEmpty();
    }
}
