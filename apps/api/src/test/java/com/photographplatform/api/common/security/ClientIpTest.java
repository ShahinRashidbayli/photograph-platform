package com.photographplatform.api.common.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link ClientIp} must not decide anything about proxy headers.
 *
 * <p>It used to return the leftmost {@code X-Forwarded-For} entry — the one
 * value in the chain the client writes themselves — which handed every
 * IP-keyed limit in the application to the caller. Who to believe is a
 * deployment fact, so it moved to {@code server.forward-headers-strategy} and
 * Tomcat's {@code RemoteIpValve}; see {@link ForwardedHeaderConfigIT}, which
 * pins that the valve is actually installed.
 *
 * <p>These tests therefore assert a <em>negative</em>: headers are ignored
 * here, whatever they say. If someone reintroduces header parsing to "fix" a
 * proxy problem, these fail rather than quietly reopening the bypass.
 */
class ClientIpTest {

    @Test
    void usesTheSocketAddress() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.7");

        assertThat(ClientIp.from(request)).isEqualTo("203.0.113.7");
    }

    @Test
    void ignoresASpoofedXForwardedFor() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.7");
        request.addHeader("X-Forwarded-For", "1.2.3.4");

        assertThat(ClientIp.from(request)).isEqualTo("203.0.113.7");
    }

    /**
     * The shape of the actual attack: the client prepends a chain hoping the
     * leftmost entry is taken. It never is — and behind a real proxy the valve
     * has already resolved this before the request reaches application code.
     */
    @Test
    void ignoresASpoofedChain() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.7");
        request.addHeader("X-Forwarded-For", "1.2.3.4, 5.6.7.8, 9.10.11.12");

        assertThat(ClientIp.from(request)).isEqualTo("203.0.113.7");
    }

    @Test
    void ignoresXRealIp() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.7");
        request.addHeader("X-Real-IP", "1.2.3.4");

        assertThat(ClientIp.from(request)).isEqualTo("203.0.113.7");
    }
}
