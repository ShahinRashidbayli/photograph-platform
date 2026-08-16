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

    @Bean
    @Conditional(HasStripeSecretKey.class)
    public StripeClient stripeClient(PaymentProperties props) {
        return new StripeClient(props.getSecretKey());
    }
}
