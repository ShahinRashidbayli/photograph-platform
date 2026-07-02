package com.photographplatform.api.auth.controller;

import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.AuthResult;
import com.photographplatform.api.auth.dto.CustomerMagicLinkRequest;
import com.photographplatform.api.auth.dto.CustomerMagicLinkVerifyRequest;
import com.photographplatform.api.auth.service.AuthCookieWriter;
import com.photographplatform.api.auth.service.CustomerAuthService;
import com.photographplatform.api.common.security.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Passwordless (magic-link) auth for customers, kept separate from
 * {@link AuthController} so the photographer flow (password + tenant
 * creation) and the customer flow (passwordless + join existing tenant)
 * stay independent.
 *
 * Customers reach these endpoints from a photographer's bio link
 * (e.g. anna-foto.fotoplatform.de/request) and never see a password field.
 */
@RestController
@RequestMapping("/api/auth/customer")
public class CustomerAuthController {

    private final CustomerAuthService service;
    private final AuthCookieWriter cookies;

    public CustomerAuthController(CustomerAuthService service, AuthCookieWriter cookies) {
        this.service = service;
        this.cookies = cookies;
    }

    /**
     * Step 1 — customer submits email + photographer subdomain.
     * Always responds 204 to avoid revealing whether the address is on file.
     */
    @PostMapping("/magic-link/request")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void requestMagicLink(
        @Valid @RequestBody CustomerMagicLinkRequest request,
        HttpServletRequest httpRequest
    ) {
        service.requestMagicLink(
            request.subdomain(),
            request.email(),
            request.fullName(),
            ClientIp.from(httpRequest)
        );
    }

    /**
     * Step 2 — customer clicks the email link; FE posts the token here.
     * On success: sets access + refresh cookies and returns the user record.
     */
    @PostMapping("/magic-link/verify")
    public AuthResponse verifyMagicLink(
        @Valid @RequestBody CustomerMagicLinkVerifyRequest request,
        HttpServletRequest httpRequest,
        HttpServletResponse response
    ) {
        AuthResult result = service.verifyMagicLink(request.token(), ClientIp.from(httpRequest));
        cookies.setAuthCookies(response, result.accessToken(), result.refreshToken());
        return result.response();
    }
}
