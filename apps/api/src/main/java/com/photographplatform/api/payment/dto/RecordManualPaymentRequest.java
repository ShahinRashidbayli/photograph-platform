package com.photographplatform.api.payment.dto;

/** Null {@code amountCents} defaults to the invoice's remaining outstanding balance. */
public record RecordManualPaymentRequest(Integer amountCents) {
}
