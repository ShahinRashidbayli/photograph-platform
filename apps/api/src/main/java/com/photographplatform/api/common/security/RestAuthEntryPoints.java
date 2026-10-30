package com.photographplatform.api.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photographplatform.api.common.exception.ErrorCode;
import com.photographplatform.api.common.exception.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/**
 * What the security filter chain answers when it refuses a request.
 *
 * <h2>Why this exists at all</h2>
 * {@code GlobalExceptionHandler} never sees these. {@code AuthorizationFilter}
 * runs before the {@code DispatcherServlet}, so a denial is handled by
 * {@code ExceptionTranslationFilter} and no {@code @RestControllerAdvice} is
 * ever consulted.
 *
 * <p>Without an entry point configured, Spring Security defaults a chain with
 * no {@code httpBasic}/{@code formLogin} to {@link
 * org.springframework.security.web.authentication.Http403ForbiddenEntryPoint}.
 * That is how <em>every</em> unauthenticated request — including one whose
 * access token simply expired — came back <strong>403</strong>.
 *
 * <p>That single status broke token refresh outright. The frontend interceptor
 * refreshes on 401 and rethrows anything else, so the refresh-token rotation
 * built in {@code AuthService} never ran: 24 hours after signing in, every user
 * hit a wall of errors and was bounced to the login screen instead of being
 * silently renewed. The machinery was correct; nothing ever reached it.
 *
 * <p>So the two cases are now answered separately, which is also what the two
 * statuses mean:
 *
 * <ul>
 *   <li><b>401</b> — no credentials, or credentials that no longer
 *       authenticate. Retrying <em>with a fresh token</em> could succeed, so
 *       the client should refresh.</li>
 *   <li><b>403</b> — authenticated fine, but this identity may not do this.
 *       Refreshing changes nothing; a CUSTOMER token pointed at the
 *       photographer's admin API is still a CUSTOMER token afterwards.</li>
 * </ul>
 *
 * <p>Spring already draws that line for us: {@code ExceptionTranslationFilter}
 * routes anonymous callers to the entry point and authenticated ones to the
 * access-denied handler.
 *
 * <p>Both write the same {@link ErrorResponse} body the rest of the API uses,
 * so a client has one shape to parse rather than Boot's default
 * {@code {"timestamp","status","error","path"}} — whose {@code error} is the
 * status name, which is what put the literal word "Forbidden" in front of users.
 */
@Component
public class RestAuthEntryPoints {

    private final ObjectMapper objectMapper;
    private final Clock clock;

    public RestAuthEntryPoints(ObjectMapper objectMapper, Clock clock) {
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /** 401 — tells the client its credentials are missing or stale. */
    public AuthenticationEntryPoint authenticationEntryPoint() {
        return (HttpServletRequest request, HttpServletResponse response,
                AuthenticationException ex) -> write(
            response, request, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED,
            "Your session has expired or you are not signed in.");
    }

    /** 403 — authenticated, but not allowed. Refreshing will not help. */
    public AccessDeniedHandler accessDeniedHandler() {
        return (HttpServletRequest request, HttpServletResponse response,
                AccessDeniedException ex) -> write(
            response, request, HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN,
            "You do not have access to this resource.");
    }

    private void write(
        HttpServletResponse response, HttpServletRequest request,
        HttpStatus status, String code, String message) throws IOException {

        // A response already committed belongs to whatever wrote it — most
        // likely a streaming download that failed mid-body. Overwriting the
        // status here would throw and mask the original failure.
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getOutputStream(), ErrorResponse.of(
            code, message, request.getRequestURI(), OffsetDateTime.now(clock)));
    }
}
