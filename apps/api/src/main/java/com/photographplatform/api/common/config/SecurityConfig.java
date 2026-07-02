package com.photographplatform.api.common.config;

import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.TenantContextFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
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
        // Double-submit cookie CSRF: a non-httpOnly XSRF-TOKEN cookie is set;
        // the FE echoes its value in the X-XSRF-TOKEN header on state-changing
        // requests. Login / register / refresh are exempt because the user has
        // no session yet — there is nothing for an attacker to abuse via CSRF.
        CookieCsrfTokenRepository csrfRepo = CookieCsrfTokenRepository.withHttpOnlyFalse();
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName("_csrf");

        return http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf
                .csrfTokenRepository(csrfRepo)
                .csrfTokenRequestHandler(csrfHandler)
                .ignoringRequestMatchers(
                    "/api/auth/login",
                    "/api/auth/register",
                    "/api/auth/refresh",
                    "/api/auth/logout",
                    "/api/auth/verify-email",
                    "/api/auth/resend-verification",
                    "/api/auth/customer/magic-link/request",
                    "/api/auth/customer/magic-link/verify",
                    "/api/public/**",
                    "/actuator/health"
                )
            )
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
                    "/api/bookings/**"
                ).hasAnyRole("PHOTOGRAPHER", "ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            // Runs after JwtAuthFilter — verifies that any authenticated request
            // has a tenant in context and pushes the tenant into MDC for log
            // correlation. Defense-in-depth against malformed JWTs and against
            // any code path that forgets to populate TenantContext.
            .addFilterAfter(tenantContextFilter, JwtAuthFilter.class)
            // Force the deferred CSRF token to resolve on every request so the
            // XSRF-TOKEN cookie is written to the response. Without this the
            // cookie is only minted after something accesses the token — meaning
            // a fresh session's first state-changing call lacks the
            // X-XSRF-TOKEN header and 403s, succeeding only on the retry once
            // the rejection itself has primed the cookie.
            .addFilterAfter(new CsrfCookieEagerFilter(), CsrfFilter.class)
            .build();
    }

    /**
     * Eagerly materialises the deferred {@link CsrfToken} so
     * {@link CookieCsrfTokenRepository} writes the XSRF-TOKEN cookie on the
     * response. With Spring Security 6's lazy CSRF the cookie would otherwise
     * be missing until something on the server side reads the token.
     */
    private static final class CsrfCookieEagerFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                        FilterChain filterChain) throws ServletException, IOException {
            CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
            if (token != null) {
                // Touching getToken() triggers the deferred supplier and causes
                // CookieCsrfTokenRepository to write the cookie.
                token.getToken();
            }
            filterChain.doFilter(request, response);
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
