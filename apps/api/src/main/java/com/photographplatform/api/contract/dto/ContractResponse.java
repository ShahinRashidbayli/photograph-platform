package com.photographplatform.api.contract.dto;

import com.photographplatform.api.contract.domain.Contract;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A contract as either audience sees it.
 *
 * <p>Deliberately omits {@code signerIp} and {@code signerUserAgent}. They are
 * signature evidence, kept for the day one is disputed — not something to hand
 * back over the API, where they would end up rendered in a UI and become one
 * more place a customer's IP address leaks.
 *
 * <p>{@code intact} is computed, not stored: it answers "does the text still
 * hash to what was signed?", which is only meaningful as a fresh comparison.
 * Persisting the answer would let it go stale against the thing it describes.
 */
public record ContractResponse(
    UUID id,
    UUID bookingId,
    String status,
    String title,
    String body,
    String recipientName,
    String recipientEmail,
    String issuerName,
    String issuerAddress,
    String issuerEmail,
    String signerName,
    OffsetDateTime signedAt,
    OffsetDateTime sentAt,
    OffsetDateTime cancelledAt,
    OffsetDateTime createdAt,
    boolean editable,
    boolean intact
) {

    public static ContractResponse from(Contract c) {
        return new ContractResponse(
            c.getId(),
            c.getBookingId(),
            c.getStatus().name(),
            c.getTitle(),
            c.getBody(),
            c.getRecipientName(),
            c.getRecipientEmail(),
            c.getIssuerName(),
            c.getIssuerAddress(),
            c.getIssuerEmail(),
            c.getSignerName(),
            c.getSignedAt(),
            c.getSentAt(),
            c.getCancelledAt(),
            c.getCreatedAt(),
            c.isEditable(),
            c.isIntact()
        );
    }
}
