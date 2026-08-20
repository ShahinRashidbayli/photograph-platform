package com.photographplatform.api.payment.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * @param clientSecret       present only on a freshly created/reused
 *                           PaymentIntent — never on history rows
 * @param publishableKey     the platform's {@code pk_…}, paired with
 *                           {@code stripeAccountId} below: charges are direct
 *                           charges on the photographer's connected account,
 *                           so Stripe.js must be initialised with BOTH or it
 *                           cannot resolve the client secret
 * @param stripeAccountId    the connected account the intent lives on
 * @param applicationFeeCents the platform's commission on this charge
 */
public record PaymentResponse(
    UUID id,
    UUID invoiceId,
    String method,
    String status,
    Integer amountCents,
    String currency,
    String clientSecret,
    String publishableKey,
    String stripeAccountId,
    Integer applicationFeeCents,
    OffsetDateTime createdAt,
    OffsetDateTime confirmedAt
) {
}
