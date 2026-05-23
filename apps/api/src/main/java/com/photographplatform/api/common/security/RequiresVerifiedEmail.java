package com.photographplatform.api.common.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks an endpoint that requires the authenticated user to have verified
 * their email address. Enforced by {@link EmailVerificationInterceptor}.
 *
 * <p>Apply to actions that produce outbound effects under the user's identity
 * (publishing a portfolio, sending booking emails, processing payments) — not
 * to read-only or profile-editing endpoints.
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiresVerifiedEmail {
}
