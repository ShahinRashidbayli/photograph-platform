package com.photographplatform.api.inquiry.dto;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * The request an authenticated customer submits after arriving from the
 * photographer's bio link (roadmap §4.5.4). Distinct from
 * {@code CreateLeadRequest}: no name/email/phone fields, because the customer
 * is already signed in — their identity is taken from the JWT, never from the
 * body. Trusting a caller-supplied id here would be the same IDOR the
 * {@code /api/customerBookings} endpoint was fixed for.
 *
 * <p>{@code eventType} and {@code budgetRange} are pattern-validated rather
 * than free text: the tenant-schema table has no CHECK constraint on those two
 * columns, so this DTO is the only thing standing between a typo'd client and
 * unscoreable garbage in the database.
 *
 * <p>The {@code website} field is a honeypot — see {@link #isHoneypotTriggered()}.
 */
public record CreateInquiryRequest(

    @NotBlank(message = "Session type is required")
    @Pattern(
        regexp = "HOCHZEIT|PORTRAIT|FAMILIE|EVENT|ANDERES",
        message = "Unknown session type"
    )
    String eventType,

    @NotBlank(message = "Budget range is required")
    @Pattern(
        regexp = "UNDER_500|500_1000|1000_2000|OVER_2000",
        message = "Unknown budget range"
    )
    String budgetRange,

    // A request for a date in the past is a form mistake, not a booking — the
    // photographer can't shoot it. Rejected at the edge so it never reaches
    // scoring, where a past date would otherwise land as a bottom-tier LOW.
    @NotNull(message = "Preferred date is required")
    @FutureOrPresent(message = "Preferred date cannot be in the past")
    LocalDate proposedDate,

    @Size(max = 200, message = "Location must be at most 200 characters")
    String location,

    @Size(max = 2000, message = "Message must be at most 2000 characters")
    String message,

    /** Honeypot — must be empty. A non-empty value indicates a bot. */
    String website,

    /**
     * The language the Customer reads, as the portal's request form sends its
     * UI language. In v1 the portal's own language switch does not update it
     * afterwards. Absent means {@code de}; see
     * {@code CustomerLanguage#fromCodeOrDefault}.
     */
    @Pattern(regexp = "de|en", message = "Language must be de or en")
    String language
) {
    public boolean isHoneypotTriggered() {
        return website != null && !website.isBlank();
    }
}
