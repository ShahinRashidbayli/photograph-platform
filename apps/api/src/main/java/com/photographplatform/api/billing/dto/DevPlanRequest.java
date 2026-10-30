package com.photographplatform.api.billing.dto;

import com.photographplatform.api.tenant.domain.Plan;
import jakarta.validation.constraints.NotNull;

/** Body of the development-only plan switch. See {@code BillingController}. */
public record DevPlanRequest(@NotNull Plan plan) {
}
