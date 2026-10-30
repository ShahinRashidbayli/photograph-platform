package com.photographplatform.api.client.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ClientResponse(
    UUID id,
    String email,
    String fullName,
    String phone,
    String notes,
    Integer totalBookings,
    Integer totalSpentCents,
    Integer upcomingBookings,
    LocalDate lastBookingDate,
    OffsetDateTime createdAt
) {}
