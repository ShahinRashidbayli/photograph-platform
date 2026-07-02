package com.photographplatform.api.common.security;

import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.exception.EmailNotVerifiedException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Enforces {@link RequiresVerifiedEmail} on annotated controller methods (or
 * controller classes). Runs after the JWT filter so the {@link Authentication}
 * is populated; an unauthenticated request would already be rejected upstream.
 *
 * <p>The DB lookup only happens for endpoints that opted into verification —
 * we don't pay the cost on every request. Caching {@code email_verified} in
 * the JWT itself would avoid even that single hit, but invalidates whenever
 * the user verifies (until the token rotates), so a one-row read is the
 * simpler trade-off here.
 */
@Component
public class EmailVerificationInterceptor implements HandlerInterceptor {

    private static final Logger LOG = LoggerFactory.getLogger(EmailVerificationInterceptor.class);

    private final UserRepository userRepository;
    /**
     * Master switch for the {@link RequiresVerifiedEmail} gate. Defaults to
     * {@code true} (production-safe). Set {@code app.email.verification-enforced=false}
     * (or {@code APP_EMAIL_VERIFICATION_ENFORCED=false}) in environments where
     * outbound email isn't wired up yet — e.g. local dev before SMTP/Resend is
     * configured, so the photographer can advance bookings / convert leads
     * without being blocked on an email they can't receive.
     *
     * <p>Never ship a non-dev environment with this set to {@code false}: it
     * makes every annotated endpoint reachable by any authenticated session,
     * which is precisely the misuse the gate exists to prevent.
     */
    private final boolean verificationEnforced;
    // One-shot log latch so we don't spam a warning line on every request when
    // verification is disabled, while still making the bypass obvious in logs.
    private final AtomicBoolean bypassWarned = new AtomicBoolean(false);

    public EmailVerificationInterceptor(
        UserRepository userRepository,
        @Value("${app.email.verification-enforced:true}") boolean verificationEnforced
    ) {
        this.userRepository = userRepository;
        this.verificationEnforced = verificationEnforced;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod method)) {
            return true;
        }

        boolean required = method.hasMethodAnnotation(RequiresVerifiedEmail.class)
            || method.getBeanType().isAnnotationPresent(RequiresVerifiedEmail.class);
        if (!required) {
            return true;
        }

        if (!verificationEnforced) {
            if (bypassWarned.compareAndSet(false, true)) {
                LOG.warn(
                    "Email-verification gate DISABLED (app.email.verification-enforced=false). "
                    + "All @RequiresVerifiedEmail endpoints are reachable without a verified address. "
                    + "Re-enable before staging/production deploys."
                );
            }
            return true;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            // Spring Security will already be returning 401/403 in this case;
            // returning true lets that flow handle the response.
            return true;
        }

        UUID userId;
        try {
            userId = UUID.fromString(auth.getName());
        } catch (IllegalArgumentException ex) {
            return true;
        }

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return true;
        }
        if (!user.isEmailVerified()) {
            throw new EmailNotVerifiedException(
                "Please verify your email address before performing this action.");
        }
        return true;
    }
}
