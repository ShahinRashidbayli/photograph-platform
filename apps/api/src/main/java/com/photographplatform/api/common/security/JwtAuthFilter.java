package com.photographplatform.api.common.security;

import com.photographplatform.api.common.config.TenantContext;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final TokenRevocationCheck revocationCheck;

    public JwtAuthFilter(JwtService jwtService, TokenRevocationCheck revocationCheck) {
        this.jwtService = jwtService;
        this.revocationCheck = revocationCheck;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {
        extractToken(request)
            .flatMap(jwtService::validateToken)
            .ifPresent(claims -> {
                String tenantId = claims.get("tenant_id", String.class);
                String role = claims.get("role", String.class);
                // A token without a tenant_id is malformed for this app — refuse
                // to authenticate it. Without this guard, downstream queries would
                // run with a null TenantContext, and the RLS policies would fail
                // closed (0 rows) rather than resolve to any tenant's data — safe,
                // but this rejects earlier with a clearer signal.
                if (tenantId == null || tenantId.isBlank() || role == null) {
                    return;
                }
                if (isRevoked(claims)) {
                    return;
                }
                TenantContext.setTenant(tenantId);
                SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(
                        claims.getSubject(),
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + role))
                    )
                );
            });
        try {
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * Whether this token was issued before its owner revoked everything —
     * signing out, or resetting a password.
     *
     * <p>Signature and expiry alone cannot answer this: a JWT is self-contained,
     * so without this check an access token stayed usable for its full 24 hours
     * after a logout, and — the case that matters — after a password reset,
     * whose entire purpose is to eject whoever is already inside the account.
     *
     * <p>Fails closed in every direction. A subject that is not a UUID, or a
     * token carrying no {@code iat}, cannot be checked against a revocation
     * instant, and a token that cannot be checked is refused rather than
     * trusted. Every token this app issues has both (see
     * {@link JwtService#generateToken}), so reaching either branch means the
     * token did not come from here.
     */
    private boolean isRevoked(Claims claims) {
        UUID userId;
        try {
            userId = UUID.fromString(claims.getSubject());
        } catch (IllegalArgumentException | NullPointerException ex) {
            return true;
        }
        Date issuedAt = claims.getIssuedAt();
        if (issuedAt == null) {
            return true;
        }
        return !revocationCheck.isTokenStillValid(userId, issuedAt.toInstant());
    }

    private Optional<String> extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return Optional.of(header.substring(7));
        }
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("access_token".equals(cookie.getName())) {
                    return Optional.of(cookie.getValue());
                }
            }
        }
        return Optional.empty();
    }
}
