package com.photographplatform.api.common;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordEncoderTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(12);

    @Test
    void encodeAndMatches() {
        String raw = "secret123";
        String hash = encoder.encode(raw);
        assertThat(encoder.matches(raw, hash)).isTrue();
    }

    @Test
    void differentHashEachTime() {
        String hash1 = encoder.encode("secret");
        String hash2 = encoder.encode("secret");
        assertThat(hash1).isNotEqualTo(hash2);
    }

    @Test
    void wrongPasswordDoesNotMatch() {
        String hash = encoder.encode("correct");
        assertThat(encoder.matches("wrong", hash)).isFalse();
    }
}
