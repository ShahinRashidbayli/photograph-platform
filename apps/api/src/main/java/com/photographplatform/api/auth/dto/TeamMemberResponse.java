package com.photographplatform.api.auth.dto;

import com.photographplatform.api.auth.domain.StaffRole;
import java.util.UUID;

/**
 * One photographer on the team screen.
 *
 * <p>No password hash, no token fields, no last-login — this is a list of
 * colleagues, and a DTO that carries more than the screen shows is how an
 * internal field ends up in a browser's network tab.
 */
public record TeamMemberResponse(
    UUID id,
    String email,
    String fullName,
    StaffRole staffRole,
    String avatarUrl
) {
}
