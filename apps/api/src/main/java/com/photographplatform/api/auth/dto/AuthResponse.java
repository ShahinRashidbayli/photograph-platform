package com.photographplatform.api.auth.dto;

import java.util.UUID;

/**
 * Public response body for /api/auth/register and /api/auth/login.
 * Tokens are NEVER included here — they live only in httpOnly cookies
 * to keep them out of reach of XSS / JavaScript.
 */
public record AuthResponse(
    UUID id,
    String email,
    String fullName,
    String role,
    boolean emailVerified,
    TenantInfo tenant
) {
    public record TenantInfo(String subdomain, String plan) {
    }
}
