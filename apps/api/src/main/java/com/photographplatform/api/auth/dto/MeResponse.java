package com.photographplatform.api.auth.dto;

import java.util.UUID;

// IMPORTANT: keep fields in sync with AuthResponse (login/register also return user data).
public record MeResponse(
    UUID id,
    String email,
    String fullName,
    String role,
    boolean emailVerified,
    TenantInfo tenant,
    String avatarUrl
) {
    public record TenantInfo(String subdomain, String plan) {
    }
}
