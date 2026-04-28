package com.photographplatform.api.auth.dto;

/**
 * Internal carrier for AuthService → AuthController.
 * Holds the public {@link AuthResponse} plus the raw access/refresh tokens
 * that will be set as httpOnly cookies (and never serialized to JSON).
 */
public record AuthResult(AuthResponse response, String accessToken, String refreshToken) {
}
