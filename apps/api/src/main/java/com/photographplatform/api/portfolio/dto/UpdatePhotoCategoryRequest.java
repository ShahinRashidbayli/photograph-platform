package com.photographplatform.api.portfolio.dto;

import java.util.UUID;

/**
 * Assign a portfolio photo to a category. A null {@code categoryId} clears the
 * assignment (moves the photo to "uncategorised").
 */
public record UpdatePhotoCategoryRequest(
    UUID categoryId
) {}
