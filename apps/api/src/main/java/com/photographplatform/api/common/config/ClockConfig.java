package com.photographplatform.api.common.config;

import com.photographplatform.api.common.util.BusinessZone;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {

    /**
     * A single injectable clock, so time-dependent rules are testable.
     *
     * <p>Trial expiry and gallery retention are both "has this date passed?"
     * decisions whose failure modes are destructive — one locks a paying
     * photographer out, the other deletes a client's wedding photos. Neither
     * can be covered by a test that calls {@code OffsetDateTime.now()}
     * internally, so both take the clock from here and tests hand them a fixed
     * one.
     *
     * <p>Pinned to {@link BusinessZone} rather than the JVM default: the
     * container's zone is an accident of deployment, and these are day counts
     * a customer reads off a calendar.
     */
    @Bean
    public Clock clock() {
        return Clock.system(BusinessZone.ID);
    }
}
