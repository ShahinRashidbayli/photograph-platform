package com.photographplatform.api.common.security;

import com.photographplatform.api.IntegrationTestBase;
import java.util.Arrays;
import org.apache.catalina.valves.RemoteIpValve;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.embedded.tomcat.TomcatWebServer;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins that proxy-header handling is actually installed in the container.
 *
 * <p>{@link ClientIp} no longer inspects {@code X-Forwarded-For} — Tomcat's
 * {@link RemoteIpValve} resolves it first, and only for hops we declared as
 * ours. That makes the whole protection a single line of configuration
 * ({@code server.forward-headers-strategy: native}), and a single line of
 * configuration is exactly the kind of thing that gets dropped in a merge
 * without anyone noticing.
 *
 * <p>If it goes, {@code getRemoteAddr()} silently starts returning the proxy's
 * own address for every request behind a load balancer. Every IP rate limit
 * then shares one bucket and locks out the entire internet at once — a failure
 * that looks like an outage, not a config change. Hence a test that asserts the
 * valve is present rather than trusting the property to stay put.
 *
 * <p>Extends {@code IntegrationTestBase} for its datasource wiring — the
 * application context will not start without one — and the Postgres container
 * is a JVM-wide singleton, so this costs nothing beyond the first suite to
 * touch it.
 */
class ForwardedHeaderConfigIT extends IntegrationTestBase {

    @Autowired
    private ServletWebServerApplicationContext context;

    @Test
    void remoteIpValveIsInstalled() {
        assertThat(remoteIpValve())
            .as("server.forward-headers-strategy must stay enabled — without it "
                + "getRemoteAddr() returns the proxy, not the client")
            .isNotNull();
    }

    /**
     * The valve is only safe because it distinguishes our hops from the
     * caller's. An empty or all-permitting {@code internalProxies} would trust
     * whatever the client sent, which is the bug this replaced.
     */
    @Test
    void internalProxiesAreRestrictedToPrivateRanges() {
        RemoteIpValve valve = remoteIpValve();

        assertThat(valve).isNotNull();
        assertThat(valve.getInternalProxies()).isNotBlank();
        assertThat(valve.getInternalProxies()).doesNotContain(".*");
        // The loopback and RFC1918 ranges a container's own edge speaks from.
        assertThat(valve.getInternalProxies()).contains("127\\.");
        assertThat(valve.getInternalProxies()).contains("10\\.");
    }

    private RemoteIpValve remoteIpValve() {
        TomcatWebServer server = (TomcatWebServer) context.getWebServer();
        return Arrays.stream(server.getTomcat().getEngine().getPipeline().getValves())
            .filter(RemoteIpValve.class::isInstance)
            .map(RemoteIpValve.class::cast)
            .findFirst()
            .orElse(null);
    }
}
