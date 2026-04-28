package com.photographplatform.api.booking.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateBookingStatusRequest(
    @NotBlank(message = "Status is required")
    String status
) {}
