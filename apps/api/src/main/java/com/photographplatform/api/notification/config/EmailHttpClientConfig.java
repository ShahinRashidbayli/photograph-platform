package com.photographplatform.api.notification.config;

import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * The HTTP client the email transports use, with automatic retries switched off.
 *
 * <p>Apache HttpClient5 is on the classpath (transitively, via stripe-java), so
 * Spring's {@code RestClient} sends through it, and its default retry strategy
 * honours the {@code Retry-After} header of a 429 or 503 by <em>sleeping for as
 * long as the header says</em> before trying once more. Measured against the
 * application's own builder: a {@code Retry-After: 5} cost 5068ms and two
 * requests.
 *
 * <p>That sleep happens on whichever thread is sending. Email goes out on the
 * {@code app-async} pool (core 8, max 24, queue 500) whose saturation policy is
 * {@code CallerRunsPolicy} — so a provider rate-limiting us parks async threads,
 * fills the queue, and then runs sends on the request threads behind it. A
 * provider's back-off schedule must not become this application's latency. Note
 * that {@code spring.http.client.read-timeout} does not bound it: the sleep is
 * between attempts, not inside one.
 *
 * <p>Nothing is given up by switching retries off here. {@code
 * DefaultHttpRequestRetryStrategy} only re-sends after an {@code IOException}
 * for idempotent methods, and every send is a POST — measured the same way, a
 * connection reset produced exactly one attempt. So the retry behaviour being
 * removed is, in practice, only the Retry-After sleep.
 *
 * <p>Built through {@link ClientHttpRequestFactoryBuilder#httpComponents()} and
 * the settings bean rather than by hand, so the connect and read timeouts from
 * {@code spring.http.client.*} still apply — only the retry strategy changes.
 *
 * <p>Retrying is the outbox's job (ADR-005): a failed send goes back to
 * {@code outbox_jobs} with its own backoff schedule, rather than holding a
 * worker thread asleep on a Retry-After.
 */
@Configuration
public class EmailHttpClientConfig {

    /** Qualifier for the non-retrying client; email transports take this one. */
    public static final String EMAIL_REST_CLIENT = "emailRestClient";

    @Bean(EMAIL_REST_CLIENT)
    public RestClient emailRestClient(
        RestClient.Builder builder, ClientHttpRequestFactorySettings settings) {
        return builder
            .requestFactory(ClientHttpRequestFactoryBuilder.httpComponents()
                .withHttpClientCustomizer(HttpClientBuilder::disableAutomaticRetries)
                .build(settings))
            .build();
    }
}
