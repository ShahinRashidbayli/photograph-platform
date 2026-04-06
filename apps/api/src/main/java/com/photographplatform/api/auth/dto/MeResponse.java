package com.photographplatform.api.auth.dto;

import java.util.UUID;

public record MeResponse(
    UUID id,
    String email,
    String fullName,
    String role,
    TenantInfo tenant
) {
    public record TenantInfo(String subdomain, String plan) {
    }
}
