package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank @Size(min = 1, max = 200) String fullName,
    @NotBlank @Email @Size(max = 320) String email,
    @NotBlank @Size(min = 10, max = 100, message = "password must be at least 10 characters")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).*$",
        message = "password must contain at least one letter and one digit")
    String password,
    @NotBlank @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$",
        message = "subdomain must be 3-63 chars, start and end with alphanumeric, hyphens allowed in between")
    String subdomain,
    @NotNull @Pattern(regexp = "PHOTOGRAPHER|CUSTOMER",
        message = "role must be PHOTOGRAPHER or CUSTOMER")
    String role,

    /**
     * Plan the visitor picked on the pricing page. Optional — a signup that
     * skips the pricing cards (nav "Get started", footer) sends nothing and
     * lands on STARTER.
     *
     * <p>This is a <em>trial</em> selection, not an entitlement: every plan is
     * free for the 14-day trial, so trusting the client here grants nothing it
     * would not already get. That stops being true the moment plan gates or
     * billing land — at which point the plan must come from a paid
     * subscription, never from this field. See docs/PRICING.md §4, §7.6.
     */
    @Pattern(regexp = "STARTER|PRO|STUDIO",
        message = "plan must be STARTER, PRO or STUDIO")
    String plan,

    /**
     * The sign-up page's UI language. Optional: absent is German. The
     * verification email goes out at once, so it is stored before then.
     */
    @Pattern(regexp = "de|en", message = "Language must be de or en")
    String language
) {
}
