package com.photographplatform.api.notification.email;

/**
 * What an {@link EmailRenderer} produces at send time.
 *
 * @param subject  never logged — it has carried a sign-in code
 * @param htmlBody never logged, and never stored (ADR-005 §3)
 */
public record RenderedEmail(String subject, String htmlBody) {}
