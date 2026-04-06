package com.photographplatform.api.auth.dto;

public record AuthResponse(
    String accessToken,
    String refreshToken,
    TenantInfo tenant
) {
    public record TenantInfo(String subdomain, String plan) {
    }
}
