package com.photographplatform.api.payment.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PaymentResponse(
    UUID id,
    UUID invoiceId,
    String method,
    String status,
    Integer amountCents,
    String currency,
    String clientSecret,
    OffsetDateTime createdAt,
    OffsetDateTime confirmedAt
) {
}
