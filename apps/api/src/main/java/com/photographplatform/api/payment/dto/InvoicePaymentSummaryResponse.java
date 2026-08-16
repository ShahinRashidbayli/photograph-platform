package com.photographplatform.api.payment.dto;

import java.util.List;

public record InvoicePaymentSummaryResponse(
    Integer totalCents,
    Integer paidCents,
    Integer outstandingCents,
    String verwendungszweck,
    List<PaymentResponse> payments
) {
}
