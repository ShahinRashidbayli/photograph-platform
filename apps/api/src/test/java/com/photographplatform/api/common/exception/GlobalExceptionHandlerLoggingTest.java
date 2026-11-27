package com.photographplatform.api.common.exception;

import com.photographplatform.api.common.logging.LogFields;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.MDC;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.servlet.HandlerMapping;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What a failure leaves in the log, and what it hands the caller to find it
 * there. The status and code mapping is covered through the controllers.
 */
@ExtendWith(OutputCaptureExtension.class)
class GlobalExceptionHandlerLoggingTest {

    private final GlobalExceptionHandler handler =
        new GlobalExceptionHandler(Clock.fixed(Instant.parse("2026-11-27T10:00:00Z"), ZoneOffset.UTC));

    @AfterEach
    void clearThread() {
        MDC.clear();
    }

    @Test
    void theErrorBodyCarriesTheRequestIdItsLogLinesCarry() {
        MDC.put(LogFields.REQUEST_ID, "req-42");

        ResponseEntity<ErrorResponse> response =
            handler.handleNotFound(new NotFoundException("Booking not found"), request("/api/bookings/1"));

        assertThat(response.getBody().requestId()).isEqualTo("req-42");
    }

    /** Postgres writes the duplicate value into the message; for a unique column here that is an email. */
    @Test
    void aUniqueViolationIsLoggedByConstraintWithoutTheValue(CapturedOutput log) {
        SQLException postgres = new SQLException(
            "ERROR: duplicate key value violates unique constraint \"users_email_key\"\n"
                + "  Detail: Key (email)=(anna@example.test) already exists.",
            "23505");

        handler.handleDataIntegrity(
            new DataIntegrityViolationException("could not execute statement", postgres),
            request("/api/clients"));

        assertThat(log.getAll())
            .contains("Data integrity violation on /api/clients (constraint=users_email_key, sqlState=23505)")
            .doesNotContain("anna@example.test");
    }

    @Test
    void anUnhandledFailureOnAGalleryLinkNamesTheRouteNotTheToken(CapturedOutput log) {
        MockHttpServletRequest request =
            new MockHttpServletRequest("GET", "/api/public/galleries/atelier/tok3n-s3cret");
        request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE,
            "/api/public/galleries/{subdomain}/{token}");

        handler.handleUnexpected(new RuntimeException("boom"), request);

        assertThat(log.getAll())
            .contains("Unhandled exception on /api/public/galleries/{subdomain}/{token}")
            .doesNotContain("tok3n-s3cret");
    }

    private static MockHttpServletRequest request(String route) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", route);
        request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, route);
        return request;
    }
}
