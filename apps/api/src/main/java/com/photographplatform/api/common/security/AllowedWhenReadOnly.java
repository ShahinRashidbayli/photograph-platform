package com.photographplatform.api.common.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Exempts an endpoint from the read-only lock a lapsed account is under.
 *
 * <p>The lock is opt-<em>out</em> rather than opt-in, deliberately: it covers
 * every mutating request from a photographer by default, so adding a new POST
 * cannot silently escape it by forgetting an annotation. A gate you have to
 * remember is not a gate.
 *
 * <p>Two kinds of endpoint must carry this, and getting either wrong is worse
 * than the lock itself:
 *
 * <ul>
 *   <li><b>Anything that ends the lock.</b> Checkout, the billing portal, plan
 *       changes. Locking these deadlocks the account: the photographer cannot
 *       pay, so they cannot unlock, so they cannot pay.</li>
 *   <li><b>Session management.</b> Login, logout, token refresh, password
 *       reset, email verification. Being unable to log in to see why you are
 *       locked out is not a lock, it is a bug report.</li>
 * </ul>
 *
 * @see WriteAccessInterceptor
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface AllowedWhenReadOnly {
}
