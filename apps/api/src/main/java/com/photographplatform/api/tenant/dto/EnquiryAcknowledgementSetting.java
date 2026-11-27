package com.photographplatform.api.tenant.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Whether a Customer who sends the public request form gets the automatic
 * "Enquiry received" acknowledgement. Read and written in the same shape.
 *
 * @param enabled boxed so a body without it is refused rather than read as off
 */
public record EnquiryAcknowledgementSetting(@NotNull Boolean enabled) {
}
