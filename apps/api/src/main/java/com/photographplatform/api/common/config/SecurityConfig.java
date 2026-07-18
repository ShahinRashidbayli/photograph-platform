package com.photographplatform.api.common.config;

import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.TenantContextFilter;
import com.photographplatform.api.common.util.TokenUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final TenantContextFilter tenantContextFilter;
    private final List<String> allowedOrigins;

    public SecurityConfig(
        JwtAuthFilter jwtAuthFilter,
        TenantContextFilter tenantContextFilter,
        @Value("${app.cors.allowed-origins}") List<String> allowedOrigins
    ) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.tenantContextFilter = tenantContextFilter;
        this.allowedOrigins = allowedOrigins;
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        // CSRF: a stateless double-submit cookie check, enforced by the custom
        // StatelessCsrfFilter (added below) rather than Spring Security's own
        // CsrfFilter. Spring couples CSRF-token rotation to authentication
        // (SessionManagementFilter -> CsrfAuthenticationStrategy); in this
        // stateless JWT API every request re-authenticates, so that rotation
        // fires on every authenticated request and races under the dashboard's
        // parallel page-load calls — intermittently deleting/rotating the
        // XSRF-TOKEN cookie out from under the client and 403-ing valid requests
        // (the "click accept twice before it works" bug). The custom filter
        // mints exactly one token, never rotates or clears it, and simply
        // verifies X-XSRF-TOKEN == the XSRF-TOKEN cookie on mutating requests.
        return http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/api/public/**", "/actuator/health", "/error").permitAll()
                // Portfolio management (upload, complete, publish, delete, owner
                // photo list) mutates the photographer's public-facing content.
                // CUSTOMER-role accounts are issued JWTs scoped to the same
                // tenant (see CustomerAuthService), so authentication alone is
                // not enough — restrict to the tenant's own staff.
                .requestMatchers("/api/portfolio/**").hasAnyRole("PHOTOGRAPHER", "ADMIN")
                // The rest of the photographer admin surface — client directory,
                // lead inbox, gallery management and booking management — exposes
                // other people's PII (emails, phones, internal notes) and lets the
                // caller mutate bookings. CUSTOMER tokens authenticate fine and
                // share the tenant, so without an explicit role gate any customer
                // could read the whole tenant's clients/leads/bookings. The
                // customer's own bookings are served separately by
                // /api/customerBookings, which scopes to the caller's identity.
                .requestMatchers(
                    "/api/clients/**",
                    "/api/leads/**",
                    "/api/galleries/**",
                    "/api/packages/**",
                    "/api/photographerBookings",
                    "/api/bookings/**",
                    // The inquiry inbox lists other customers' names, emails,
                    // budgets and messages — same PII exposure as the lead inbox,
                    // same gate.
                    "/api/inquiries/**"
                ).hasAnyRole("PHOTOGRAPHER", "ADMIN")
                // The customer's own surface. Gated to CUSTOMER rather than left
                // to anyRequest() so the role boundary is symmetric: a
                // photographer has no business filing an inquiry against their
                // own tenant, and an explicit gate means a future endpoint added
                // under /api/customer/** can't silently inherit a wider audience
                // than intended. (Note this is /api/customer/**, distinct from
                // the permitAll /api/auth/customer/** magic-link routes above.)
                .requestMatchers("/api/customer/**").hasRole("CUSTOMER")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            // Runs after JwtAuthFilter — verifies that any authenticated request
            // has a tenant in context and pushes the tenant into MDC for log
            // correlation. Defense-in-depth against malformed JWTs and against
            // any code path that forgets to populate TenantContext.
            .addFilterAfter(tenantContextFilter, JwtAuthFilter.class)
            // Stateless double-submit CSRF: mints the XSRF-TOKEN cookie when
            // absent and verifies it against the X-XSRF-TOKEN header on mutating
            // requests. Auth-independent, so its position in the chain does not
            // matter — placed first so a rejected request never touches app code.
            .addFilterBefore(new StatelessCsrfFilter(), UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    /**
     * Stateless double-submit CSRF, replacing Spring Security's session-coupled
     * {@code CsrfFilter}. The contract with the frontend is unchanged: a
     * non-httpOnly {@code XSRF-TOKEN} cookie whose value the client echoes in the
     * {@code X-XSRF-TOKEN} header on every state-changing request.
     *
     * <p>Why hand-rolled: Spring rotates the CSRF token on authentication (via
     * {@code SessionManagementFilter} → {@code CsrfAuthenticationStrategy}). This
     * API authenticates from the JWT on <em>every</em> request, so that rotation
     * fired constantly and, under the dashboard's parallel page-load fetches,
     * raced — deleting or rotating the cookie out from under the client so the
     * next mutating call 403'd. This filter instead treats the token as a stable
     * value: mint it once when absent, then never rotate or clear it. Being pure
     * double-submit it needs no server-side state, so concurrent requests cannot
     * desynchronise it.
     */
    private static final class StatelessCsrfFilter extends OncePerRequestFilter {

        private static final String COOKIE_NAME = "XSRF-TOKEN";
        private static final String HEADER_NAME = "X-XSRF-TOKEN";
        private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE");

        // Paths that legitimately change state before the browser holds an
        // XSRF-TOKEN cookie — the auth handshakes and public intake. Mirrors the
        // former Spring {@code ignoringRequestMatchers} list exactly. Everything
        // else that mutates must present a matching header. Kept as exact matches
        // (not an /api/auth/** prefix) so authenticated mutations like a profile
        // update stay protected.
        private static final Set<String> EXEMPT_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/refresh",
            "/api/auth/logout",
            "/api/auth/verify-email",
            "/api/auth/resend-verification",
            "/api/auth/password/forgot",
            "/api/auth/password/reset",
            "/api/auth/customer/magic-link/request",
            "/api/auth/customer/magic-link/verify",
            "/actuator/health"
        );

        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                        FilterChain filterChain) throws ServletException, IOException {
            String cookieToken = readCookieToken(request);
            if (cookieToken == null || cookieToken.isBlank()) {
                // Mint once so the client always has a value to echo. Left alone
                // on every subsequent request — never rotated or cleared.
                cookieToken = TokenUtils.generateSecureToken();
                ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, cookieToken)
                    .path("/")
                    .httpOnly(false)
                    .sameSite("Lax")
                    .build();
                response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
            }

            if (!SAFE_METHODS.contains(request.getMethod()) && !isExempt(request)) {
                String header = request.getHeader(HEADER_NAME);
                if (header == null || !constantTimeEquals(header, cookieToken)) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN, "Invalid CSRF token");
                    return;
                }
            }
            filterChain.doFilter(request, response);
        }

        private static boolean isExempt(HttpServletRequest request) {
            String path = request.getRequestURI();
            return EXEMPT_PATHS.contains(path) || path.startsWith("/api/public/");
        }

        private static String readCookieToken(HttpServletRequest request) {
            if (request.getCookies() == null) {
                return null;
            }
            for (Cookie cookie : request.getCookies()) {
                if (COOKIE_NAME.equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
            return null;
        }

        private static boolean constantTimeEquals(String a, String b) {
            return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
        }
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "Authorization", "X-XSRF-TOKEN", "X-Requested-With"));
        config.setExposedHeaders(List.of("X-XSRF-TOKEN"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
