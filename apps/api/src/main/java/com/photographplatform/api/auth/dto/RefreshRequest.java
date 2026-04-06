package com.photographplatform.api.auth.dto;

/**
 * refreshToken is nullable — when omitted the controller reads the value from
 * the HttpOnly refresh_token cookie (browser flow).  Postman / API clients may
 * still supply it in the request body.
 */
public record RefreshRequest(String refreshToken) {
}
