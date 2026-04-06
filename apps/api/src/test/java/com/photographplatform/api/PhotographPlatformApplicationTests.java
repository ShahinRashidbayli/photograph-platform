package com.photographplatform.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.flyway.enabled=false",
    "spring.autoconfigure.exclude=" +
        "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration," +
        "org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration",
    // jwt + cors values come from test/resources/application.yml
    "app.jwt.access-token-expiry-ms=86400000",
    "app.jwt.refresh-token-expiry-ms=2592000000",
    "app.cors.allowed-origins=http://localhost:3000"
})
class PhotographPlatformApplicationTests {

    @MockitoBean
    StringRedisTemplate redisTemplate;

    @Test
    void contextLoads() {
    }
}
