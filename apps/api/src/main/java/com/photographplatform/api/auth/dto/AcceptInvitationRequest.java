package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Claiming a seat.
 *
 * <p>No email field: the address is the one the invitation was sent to, read
 * from the token. Accepting an invitation addressed to somebody else — by
 * forwarding the mail and typing a different address — would be a way into a
 * studio that never invited you.
 *
 * <p>The password rules are {@code RegisterRequest}'s, deliberately repeated
 * rather than relaxed. This creates a full staff account with access to a
 * studio's clients and galleries; that it arrived by invitation makes it no
 * less worth protecting.
 */
public record AcceptInvitationRequest(
    @NotBlank String token,
    @NotBlank @Size(min = 1, max = 200) String fullName,
    @NotBlank @Size(min = 10, max = 100, message = "password must be at least 10 characters")
    @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).*$",
        message = "password must contain at least one letter and one digit")
    String password
) {
}
