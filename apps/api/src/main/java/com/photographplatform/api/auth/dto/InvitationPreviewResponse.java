package com.photographplatform.api.auth.dto;

/**
 * What the acceptance screen may say before anyone commits to anything.
 *
 * <p>The studio's name and the invited address, and nothing else. It is served
 * unauthenticated to whoever holds the link, so every field here is a field
 * shown to an unknown visitor — the team roster, the owner's identity and the
 * studio's client counts are all deliberately absent.
 */
public record InvitationPreviewResponse(
    String studioName,
    String email
) {
}
