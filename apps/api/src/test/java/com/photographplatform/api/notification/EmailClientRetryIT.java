package com.photographplatform.api.notification;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.notification.config.EmailHttpClientConfig;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The email transports must not sleep out a provider's {@code Retry-After}.
 *
 * <p>SendGrid and Resend both answer 429 when an account is over its rate, and
 * both name a delay in the header. Apache HttpClient5 — which backs Spring's
 * {@code RestClient} because stripe-java puts it on the classpath — takes that
 * literally: its default strategy sleeps for the stated number of seconds and
 * tries once more. Against the application's plain builder, {@code Retry-After: 5}
 * cost 5068ms and two requests.
 *
 * <p>The thread doing the sleeping is an {@code app-async} one, and that pool
 * rejects with {@code CallerRunsPolicy}, so a long enough back-off works its way
 * out to the request threads. BUG-006 in docs/BUGS.md has the chain.
 */
class EmailClientRetryIT extends IntegrationTestBase {

    @Autowired
    @Qualifier(EmailHttpClientConfig.EMAIL_REST_CLIENT)
    private RestClient emailRestClient;

    /**
     * A provider that is rate-limiting us, asking for a wait far longer than any
     * request should take.
     */
    @Test
    void doesNotWaitOutARetryAfterHeader() throws Exception {
        AtomicInteger requests = new AtomicInteger();
        HttpServer provider = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        provider.createContext("/mail/send", exchange -> {
            requests.incrementAndGet();
            exchange.getResponseHeaders().add("Retry-After", "30");
            exchange.sendResponseHeaders(429, -1);
            exchange.close();
        });
        provider.start();

        String url = "http://127.0.0.1:" + provider.getAddress().getPort() + "/mail/send";
        long startedAt = System.nanoTime();
        try {
            assertThatThrownBy(() -> emailRestClient.post().uri(url).body("{}")
                .retrieve().toBodilessEntity())
                .as("a 429 should still surface to the caller")
                .isInstanceOf(RuntimeException.class);
        } finally {
            provider.stop(0);
        }
        Duration elapsed = Duration.ofNanos(System.nanoTime() - startedAt);

        assertThat(requests.get())
            .as("the provider said no; asking again is its own problem, not an answer")
            .isEqualTo(1);
        // Generous on purpose: the failure being ruled out is a 30-second sleep,
        // so anything near the header's value fails and ordinary slowness does not.
        assertThat(elapsed)
            .as("a rate-limited send must fail fast rather than park the thread")
            .isLessThan(Duration.ofSeconds(5));
    }
}
