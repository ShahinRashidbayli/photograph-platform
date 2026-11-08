package com.photographplatform.api.auth.controller;

import com.photographplatform.api.common.security.AllowedWhenReadOnly;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.AuthResult;
import com.photographplatform.api.auth.dto.CustomerLoginCodeVerifyRequest;
import com.photographplatform.api.auth.dto.CustomerMagicLinkRequest;
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
 * Passwordless auth for customers by emailed six-digit code, kept separate from
 * {@link AuthController} so the photographer flow (password + tenant creation)
 * and the customer flow (passwordless + join existing tenant) stay independent.
 *
 * <p>Customers reach these endpoints from a photographer's bio link
 * (e.g. anna-foto.fotolio.de/request) and never see a password field. A code
 * rather than a link because that bio link opens inside Instagram's in-app
 * browser — see {@link CustomerAuthService} for why a link loses the sign-in
 * even when it works.
 */
@RestController
@RequestMapping("/api/auth/customer")
// Clients are not the party being billed — their magic-link login keeps
// working regardless of the photographer's subscription state.
@AllowedWhenReadOnly
public class CustomerAuthController {

    private final CustomerAuthService service;
    private final AuthCookieWriter cookies;

    public CustomerAuthController(CustomerAuthService service, AuthCookieWriter cookies) {
        this.service = service;
        this.cookies = cookies;
    }

    /**
     * Step 1 — customer submits email + photographer subdomain; we email a code.
     * Always responds 204 to avoid revealing whether the address is on file.
     */
    @PostMapping("/login-code/request")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void requestLoginCode(
        @Valid @RequestBody CustomerMagicLinkRequest request,
        HttpServletRequest httpRequest
    ) {
        if (request.subdomain() == null || request.subdomain().isBlank()) {
            service.requestLoginCodeByEmail(request.email(), request.fullName(), ClientIp.from(httpRequest));
            return;
        }
        service.requestLoginCode(
            request.subdomain(),
            request.email(),
            request.fullName(),
            ClientIp.from(httpRequest)
        );
    }

    /**
     * Step 2 — customer types the code back into the page they never left.
     * On success: sets access + refresh cookies and returns the user record.
     */
    @PostMapping("/login-code/verify")
    public AuthResponse verifyLoginCode(
        @Valid @RequestBody CustomerLoginCodeVerifyRequest request,
        HttpServletRequest httpRequest,
        HttpServletResponse response
    ) {
        AuthResult result = request.subdomain() == null || request.subdomain().isBlank()
            ? service.verifyLoginCodeByEmail(request.email(), request.code(), ClientIp.from(httpRequest))
            : service.verifyLoginCode(
                request.subdomain(), request.email(), request.code(), ClientIp.from(httpRequest));
        cookies.setAuthCookies(response, result.accessToken(), result.refreshToken());
        return result.response();
    }
}
