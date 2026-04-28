package com.photographplatform.api.lead.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * Public lead capture payload.
 *
 * <p>The {@code website} field is a honeypot: legitimate users never see or
 * fill it (the form input is hidden via CSS / aria-hidden). Bots that auto-fill
 * every input will populate it, allowing the controller to silently reject the
 * request without burning a rate-limit slot for real users.
 */
public record CreateLeadRequest(
    @NotBlank(message = "Name is required")
    String name,

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    String email,

    String phone,

    @NotNull(message = "Event date is required")
    LocalDate eventDate,

    @NotBlank(message = "Event type is required")
    String eventType,

    @NotBlank(message = "Budget range is required")
    String budgetRange,

    String message,

    /** Honeypot — must be empty. Non-empty value indicates a bot. */
    String website
) {
    public boolean isHoneypotTriggered() {
        return website != null && !website.isBlank();
    }
}
