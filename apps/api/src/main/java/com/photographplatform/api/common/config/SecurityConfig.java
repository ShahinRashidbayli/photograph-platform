package com.photographplatform.api.common.config;

import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.RestAuthEntryPoints;
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
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseCookie;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;
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
    private final RestAuthEntryPoints authEntryPoints;
    private final List<String> allowedOrigins;
    private final boolean cookieSecure;
    private final String cookieSameSite;

    public SecurityConfig(
        JwtAuthFilter jwtAuthFilter,
        TenantContextFilter tenantContextFilter,
        RestAuthEntryPoints authEntryPoints,
        @Value("${app.cors.allowed-origins}") List<String> allowedOrigins,
        @Value("${app.cookie.secure:false}") boolean cookieSecure,
        @Value("${app.cookie.same-site:Lax}") String cookieSameSite
    ) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.tenantContextFilter = tenantContextFilter;
        this.authEntryPoints = authEntryPoints;
        this.allowedOrigins = allowedOrigins;
        this.cookieSecure = cookieSecure;
        this.cookieSameSite = cookieSameSite;
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
            // Without this, a chain with no httpBasic/formLogin defaults to
            // Http403ForbiddenEntryPoint and answers 403 for an expired token —
            // which the frontend interceptor does not refresh on, so refresh
            // never ran at all. See RestAuthEntryPoints for the full account.
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(authEntryPoints.authenticationEntryPoint())
                .accessDeniedHandler(authEntryPoints.accessDeniedHandler()))
            .authorizeHttpRequests(SecurityConfig::authorizationRules)
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
            .addFilterBefore(
                new StatelessCsrfFilter(cookieSecure, cookieSameSite),
                UsernamePasswordAuthenticationFilter.class)
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

        /**
         * The same {@code app.cookie.*} settings {@code AuthCookieWriter} applies
         * to the auth cookies. They used to be hardcoded here — so in an HTTPS
         * deployment the auth cookies carried {@code Secure} and this one did
         * not, which is exactly the kind of split that survives a review because
         * each file looks fine on its own.
         */
        private final boolean secure;
        private final String sameSite;

        private StatelessCsrfFilter(boolean secure, String sameSite) {
            this.secure = secure;
            this.sameSite = sameSite;
        }

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
            "/api/auth/customer/login-code/request",
            "/api/auth/customer/login-code/verify",
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
                    // Readable by script on purpose — the client has to echo it
                    // back in the header for double-submit to mean anything.
                    .httpOnly(false)
                    .secure(secure)
                    .sameSite(sameSite)
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

    /**
     * Who may reach what.
     *
     * <p>Lifted out of {@link #filterChain(HttpSecurity)} so the rules read as
     * one list rather than as a clause in the middle of the chain assembly —
     * and because this is the part of the configuration that has to be read
     * carefully when anything is added.
     *
     * <p>{@code /api/public/**} is read by visitors with no session: portfolio,
     * gallery by token, lead intake, Impressum, Stripe webhooks — and the
     * studio logo ({@code /api/public/studios/{subdomain}/logo}), which mail
     * clients load from Customer messages days after they were sent.
     */
    private static void authorizationRules(
        AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry auth) {
        auth.requestMatchers("/api/auth/**", "/api/public/**", "/actuator/health", "/error").permitAll()
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
                "/api/inquiries/**",
                // Contracts hold the other party's name and email plus the
                // photographer's own drafts. The customer's view of the
                // same documents is /api/customer/contracts/**, which is
                // scoped to the caller's own address — this one is not.
                // Send and resend (POST …/{id}/send|resend) email the Customer
                // in the studio's name, so they are staff-only too.
                "/api/contracts/**",
                // Which unbuilt ideas this studio has asked for. Tenant-wide
                // and the owner's business, like every other answer here.
                "/api/roadmap/**"
            ).hasAnyRole("PHOTOGRAPHER", "ADMIN")
            // Tenant-level settings: the business identity printed on every
            // invoice (including the tenant's tax numbers) and the Stripe
            // Connect payout link, and the switch for the automatic enquiry
            // acknowledgement. Tenant-wide, not per-user — a CUSTOMER
            // shares the tenant and must never read or rewrite it. The
            // customer's own account settings live under /api/auth/me.
            .requestMatchers("/api/settings/**").hasAnyRole("PHOTOGRAPHER", "ADMIN")
            // Fotolio's own subscription — what the photographer pays US.
            // Tenant-wide and strictly the account owner's business: a
            // CUSTOMER shares the tenant, so without this rule a client
            // could read their photographer's plan and billing state, or
            // open a Stripe portal session against their customer record.
            // (Their own invoices are a different thing entirely and live
            // under /api/invoices.)
            .requestMatchers("/api/billing/**").hasAnyRole("PHOTOGRAPHER", "ADMIN")
            // Erasing a person's data (Art. 17) across the whole studio. The
            // studio is the controller and carries the request out; a CUSTOMER
            // shares the tenant and could otherwise erase anyone in it. The
            // controller narrows this further to the owner.
            .requestMatchers("/api/privacy/**").hasAnyRole("PHOTOGRAPHER", "ADMIN")
            // Recording a manual (bank-transfer) payment is the photographer
            // taking their own word for money having arrived — never a
            // customer action. Declared before the broader payments matcher
            // below so this narrower, stricter rule wins.
            .requestMatchers(HttpMethod.POST, "/api/invoices/*/payments/manual")
                .hasAnyRole("PHOTOGRAPHER", "ADMIN")
            // A customer completes their own invoice's payment with Stripe.js
            // (PaymentController#createIntent) and reads its paid/outstanding
            // summary (PaymentController#summary) — both must be reachable by
            // CUSTOMER, unlike the rest of the invoice surface below.
            // PaymentService scopes each lookup to the caller's own booking
            // for CUSTOMER callers (see SecurityUtils#currentUserHasRole).
            .requestMatchers("/api/invoices/*/payments/**").hasAnyRole("PHOTOGRAPHER", "ADMIN", "CUSTOMER")
            // Invoices carry the buyer's name/email and the tenant's own tax
            // details — same financial-PII exposure as the client directory.
            .requestMatchers("/api/invoices/**").hasAnyRole("PHOTOGRAPHER", "ADMIN")
            // The customer's own surface. Gated to CUSTOMER rather than left
            // to anyRequest() so the role boundary is symmetric: a
            // photographer has no business filing an inquiry against their
            // own tenant, and an explicit gate means a future endpoint added
            // under /api/customer/** can't silently inherit a wider audience
            // than intended. (Note this is /api/customer/**, distinct from
            // the permitAll /api/auth/customer/** login-code routes above.)
            .requestMatchers("/api/customer/**").hasRole("CUSTOMER")

            // ── The four prefixes that used to have no rule at all ──────
            // Each inherited anyRequest().authenticated() and was therefore
            // reachable by a CUSTOMER, whose JWT is minted against this same
            // tenant. Confirmed with a real customer token against a running
            // API, not inferred — docs/BUGS.md BUG-002..005, BUG-008.

            // The studio's Impressum and VAT id: the imprint a regulator or a
            // claimant reads, and the one a customer could not merely read but
            // rewrite (PUT answered 200). The public read-only view is
            // /api/public/legal/{subdomain}, permitAll above.
            .requestMatchers("/api/tenant/**").hasAnyRole("PHOTOGRAPHER", "ADMIN")
            // The staff roster: colleagues' names, addresses and seat
            // counts, and the owner's own email. Every mutation here
            // already calls OwnershipGuard, so the hole was the GET — but
            // the rule covers the prefix so a future team endpoint cannot
            // arrive unguarded. POST /api/team/leave is included
            // deliberately: it deletes the caller's account, which for a
            // customer is neither a thing they are nor a thing they should
            // be able to do through the staff surface.
            .requestMatchers("/api/team/**").hasAnyRole("PHOTOGRAPHER", "ADMIN")
            // Rooms and kit. Writable, and ResourceService scopes by tenant
            // only, so a customer could create and edit the studio's own
            // inventory.
            .requestMatchers("/api/resources/**").hasAnyRole("PHOTOGRAPHER", "ADMIN")
            // The studio's money. The report already calls
            // requireCapabilityForCurrentTenant(ANALYTICS) — but that is a
            // *plan* gate, not a *role* gate, so on a tenant whose plan
            // includes analytics every authenticated caller passed it. The
            // dashboard's /summary has no plan gate at all, so for it this
            // rule is the only one.
            .requestMatchers("/api/analytics/**").hasAnyRole("PHOTOGRAPHER", "ADMIN")

            // ── Deliberately open to any authenticated caller ───────────
            // Both answer about the caller, not about the studio, and both
            // are scoped to whoever is asking: a photographer hitting
            // customerBookings gets their own (empty) list, and the plan an
            // entitlement check reports is already in /api/auth/me.
            // Written out rather than left to a default, because that is
            // the distinction this whole block exists to make.
            .requestMatchers("/api/customerBookings").authenticated()
            .requestMatchers("/api/entitlements").authenticated()

            // Deny by default. This was authenticated(), which made an
            // unruled endpoint invisible as a mistake rather than a failure:
            // it simply served every logged-in account, customers included,
            // and four prefixes drifted in exactly that way. EndpointRoleMatrixIT
            // holds the other half — every registered route must be classified
            // there, so "write a rule" cannot be skipped quietly either.
            // Consequence: an unhandled path now answers 403, not 404, since
            // authorization is decided before dispatch. See BUG-011.
            .anyRequest().denyAll();
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
