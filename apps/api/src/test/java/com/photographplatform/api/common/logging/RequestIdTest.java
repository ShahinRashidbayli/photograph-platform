package com.photographplatform.api.common.logging;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/** The edge's id is adopted only when it is shaped like one; the header is client-reachable. */
class RequestIdTest {

    @Test
    void anIdShapedHeaderIsAdopted() {
        assertThat(RequestId.resolve("Ab9_x-Y.z")).isEqualTo("Ab9_x-Y.z");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {
        // A newline would let a caller forge a second line in plain-text logs.
        "abc\nINFO forged line",
        "has space",
        "quote\"breaks",
    })
    void anythingElseIsReplacedWithAFreshId(String header) {
        String id = RequestId.resolve(header);

        assertThat(id).isNotEqualTo(header);
        assertThatCode(() -> UUID.fromString(id)).doesNotThrowAnyException();
    }

    @Test
    void anOverlongHeaderIsReplacedRatherThanTruncated() {
        String padded = "a".repeat(65);

        assertThat(RequestId.resolve(padded)).isNotEqualTo(padded).hasSize(36);
        assertThat(RequestId.resolve("a".repeat(64))).isEqualTo("a".repeat(64));
    }
}
