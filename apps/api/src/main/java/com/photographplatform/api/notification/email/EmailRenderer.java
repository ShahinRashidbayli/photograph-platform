package com.photographplatform.api.notification.email;

import com.photographplatform.api.notification.dto.EmailType;

/**
 * Turns a queued email's inputs into its subject and body, when it is sent.
 *
 * <p>The outbox stores the inputs, never the rendered email (ADR-005 §3): a
 * body is personal data in its most readable form, and rendering late also
 * picks up today's template and base URL rather than those of the moment it
 * was queued. So every email is a renderer bean, found by {@link #template()},
 * and the class that queues an email is usually the one that renders it.
 *
 * <p>{@link #template()} is stored in queued rows, so it must stay stable: a
 * renamed template strands every row queued before the deploy. {@code P} is
 * stored as JSON — add fields freely, but a removed or renamed field is a
 * breaking change for rows already queued.
 *
 * @param <P> the inputs; a record of strings, ids and dates
 */
public interface EmailRenderer<P> {

    /** Stable name stored with each queued email, e.g. {@code "auth.password-reset"}. */
    String template();

    EmailType type();

    Class<P> paramsType();

    /** Must not throw for any input it accepted when queued; a throw here is retried like a provider outage. */
    RenderedEmail render(P params);
}
