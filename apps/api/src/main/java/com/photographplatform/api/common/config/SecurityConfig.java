package com.photographplatform.api.common.config;

import com.photographplatform.api.common.security.JwtAuthFilter;
import com.photographplatform.api.common.security.TenantContextFilter;
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
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

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
                    "/api/public/**",
                    "/actuator/health"
                )
            )
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/api/public/**", "/actuator/health", "/error").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            // Runs after JwtAuthFilter — verifies that any authenticated request
            // has a tenant in context and pushes the tenant into MDC for log
            // correlation. Defense-in-depth against malformed JWTs and against
            // any code path that forgets to populate TenantContext.
            .addFilterAfter(tenantContextFilter, JwtAuthFilter.class)
            .build();
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
