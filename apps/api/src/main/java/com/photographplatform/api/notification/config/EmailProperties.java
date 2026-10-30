package com.photographplatform.api.notification.config;

import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Central email configuration, bound from {@code app.email.*}.
 *
 * <p>Replaces the per-service {@code @Value("${resend.from-email}")} reads that
 * previously lived in four separate services — the sender identity now has a
 * single source of truth. The active transport is chosen by {@link #provider}
 * (see the {@code EmailSender} implementations, each gated by
 * {@code @ConditionalOnProperty}); {@link #from} / {@link #fromName} are
 * provider-agnostic and stamped onto every outbound message.
 *
 * <h2>Why this validates at startup</h2>
 * Email is the load-bearing channel for magic-link sign-in, address
 * verification and lead alerts, and every send is deliberately best-effort:
 * {@code EmailService} swallows delivery failures so a mail outage cannot roll
 * back the booking or login that triggered it. That safety property has a sharp
 * edge — a <em>misconfigured</em> provider is indistinguishable from a healthy
 * one. Naming SendGrid without an API key would drop every message while the
 * magic-link endpoint still answers 204, so customers would simply never receive
 * a login link and nothing anywhere would say why.
 *
 * <p>So "can we actually send?" is answered once, at boot, and loudly. A
 * provider named without credentials refuses to start the application rather
 * than swallowing mail in production. Disabling email is still allowed, but it
 * must be said out loud ({@code EMAIL_PROVIDER=none}) — it can no longer happen
 * by omission.
 *
 * <p>Because of this, the senders can trust their credentials exist and need no
 * per-message "is this configured?" branch.
 */
@ConfigurationProperties("app.email")
public record EmailProperties(
    String provider,
    String from,
    String fromName,
    Provider sendgrid,
    Provider resend
) {
    private static final Logger LOG = LoggerFactory.getLogger(EmailProperties.class);

    /** Transports that can actually deliver a message. */
    public static final String SENDGRID = "sendgrid";
    public static final String RESEND = "resend";
    /**
     * Relay through an SMTP server. Unlike the hosted APIs this needs no
     * account, which is what makes email testable on a dev machine at all —
     * see {@code SmtpEmailSender}. Its connection settings live under Spring's
     * own {@code spring.mail.*}, not here.
     */
    public static final String SMTP = "smtp";
    /** Logs and drops. Legitimate for local dev and tests — never for production. */
    public static final String NONE = "none";

    private static final Set<String> KNOWN = Set.of(SENDGRID, RESEND, SMTP, NONE);

    /** Per-provider transport credentials. */
    public record Provider(String apiKey, String baseUrl) {}

    public EmailProperties {
        // Absent config (the test context binds no app.email.* at all) means
        // "don't send", matching NoOpEmailSender's matchIfMissing=true.
        provider = provider == null || provider.isBlank()
            ? NONE
            : provider.trim().toLowerCase(Locale.ROOT);

        if (!KNOWN.contains(provider)) {
            // Without this the failure is a NoSuchBeanDefinitionException for
            // EmailSender several frames deep — true, but it never mentions the
            // typo that caused it.
            throw new IllegalStateException(
                "Unknown EMAIL_PROVIDER '" + provider + "'. Expected one of: "
                    + SENDGRID + ", " + RESEND + ", " + SMTP + ", " + NONE + ".");
        }

        if (NONE.equals(provider)) {
            LOG.warn("""

                ────────────────────────────────────────────────────────────────
                EMAIL IS DISABLED (EMAIL_PROVIDER=none).
                Magic-link sign-in, address verification and lead alerts will be
                logged and dropped — customers will NOT receive a login link.
                Fine locally; never correct in staging/production. Set
                EMAIL_PROVIDER=sendgrid (or resend) with the matching API key.
                ────────────────────────────────────────────────────────────────""");
        } else if (SMTP.equals(provider)) {
            // No API key to check: the host lives under spring.mail.* and is
            // verified by SmtpEmailSender, which is the only thing that can
            // tell whether Boot actually built a JavaMailSender. The sender
            // identity is still ours to enforce.
            requireFrom(provider, from);
        } else {
            // A real transport was named, so everything it needs must be present
            // now — the next chance to notice is a customer who cannot log in.
            requireConfigured(provider, SENDGRID.equals(provider) ? sendgrid : resend, from);
        }
    }

    private static void requireConfigured(String provider, Provider credentials, String from) {
        String apiKeyEnvVar = SENDGRID.equals(provider) ? "SENDGRID_API_KEY" : "RESEND_API_KEY";

        if (credentials == null || credentials.apiKey() == null || credentials.apiKey().isBlank()) {
            throw new IllegalStateException(
                "EMAIL_PROVIDER=" + provider + " but " + apiKeyEnvVar + " is not set. "
                    + "Set the API key, or set EMAIL_PROVIDER=none to run without email.");
        }
        if (credentials.baseUrl() == null || credentials.baseUrl().isBlank()) {
            throw new IllegalStateException(
                "EMAIL_PROVIDER=" + provider + " but app.email." + provider
                    + ".base-url is blank.");
        }
        requireFrom(provider, from);
    }

    private static void requireFrom(String provider, String from) {
        if (from == null || from.isBlank()) {
            throw new IllegalStateException(
                "EMAIL_PROVIDER=" + provider + " but EMAIL_FROM is not set. It must be a sender "
                    + "address the transport will accept — for the hosted providers, one "
                    + "verified in the account (SendGrid Single Sender / domain "
                    + "authentication), or every send is rejected with a 403.");
        }
    }
}
