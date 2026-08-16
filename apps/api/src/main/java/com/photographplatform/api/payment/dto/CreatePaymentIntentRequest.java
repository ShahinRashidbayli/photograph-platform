package com.photographplatform.api.payment.dto;

import com.photographplatform.api.payment.domain.PaymentMethod;
import jakarta.validation.constraints.NotNull;

public record CreatePaymentIntentRequest(@NotNull PaymentMethod method) {
}
