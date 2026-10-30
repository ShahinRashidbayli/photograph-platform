package com.photographplatform.api.payment.config;

import com.stripe.StripeClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.type.AnnotatedTypeMetadata;

@Configuration
public class StripeConfig {

    /**
     * True only when a real (non-blank) secret key is configured.
     * {@code @ConditionalOnProperty} without {@code havingValue} treats an
     * empty string as "present" and would match {@code app.stripe.secret-key: }
     * — the exact blank default this app ships with until a real key is set
     * — so a plain property-presence check can't distinguish "configured" from
     * "absent" here the way it can for other conditional beans.
     */
    static final class HasStripeSecretKey implements Condition {
        @Override
        public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
            String key = context.getEnvironment().getProperty("app.stripe.secret-key", "");
            return key != null && !key.isBlank();
        }
    }

    /**
     * Timeouts here are not tuning — they are what stops one slow dependency
     * from taking the whole API down.
     *
     * <p>{@code new StripeClient(key)} accepts the SDK defaults: 30 s to
     * connect, <b>80 s</b> to read, and 2 automatic retries. Roughly five and a
     * half minutes for a single call in the worst case.
     *
     * <p>That would be survivable if these calls were isolated, and they are
     * not: {@code PaymentService} issues them while holding a
     * {@code PESSIMISTIC_WRITE} lock on the invoice row and a connection out of
     * a pool of ten, whose own {@code connection-timeout} is five seconds. A
     * Stripe slowdown therefore does not degrade payments — it exhausts the
     * pool and 500s every unrelated request in the product.
     *
     * <p>So: fail in seconds, not minutes. 5 s to connect and 15 s to read are
     * generous against Stripe's normal sub-second responses while staying well
     * inside a request a person is waiting on.
     *
     * <p>One retry, not two. Retries multiply the worst case, and the paths
     * that matter here are already safe to retry from the outside — the client
     * can press the button again, and {@code createStripePaymentIntent} reuses
     * or supersedes an existing intent rather than minting a second charge.
     */
    @Bean
    @Conditional(HasStripeSecretKey.class)
    public StripeClient stripeClient(PaymentProperties props) {
        return StripeClient.builder()
            .setApiKey(props.getSecretKey())
            .setConnectTimeout(CONNECT_TIMEOUT_MS)
            .setReadTimeout(READ_TIMEOUT_MS)
            .setMaxNetworkRetries(MAX_NETWORK_RETRIES)
            .build();
    }

    private static final int CONNECT_TIMEOUT_MS = 5_000;
    private static final int READ_TIMEOUT_MS = 15_000;
    private static final int MAX_NETWORK_RETRIES = 1;
}
