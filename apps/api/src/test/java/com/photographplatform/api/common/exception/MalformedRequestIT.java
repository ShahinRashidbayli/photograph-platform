package com.photographplatform.api.common.exception;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A request the server cannot read is the caller's mistake: 400, not 500.
 *
 * <p>Spring answers these with 400 by itself, but only when nothing else claims
 * them first, and {@code GlobalExceptionHandler}'s catch-all did. A malformed
 * body or a non-UUID id therefore came back as "Something went wrong on our
 * side" and an ERROR line, which is the line alerting will hang off (QA pass
 * #124, F-23).
 *
 * <p>Through the real HTTP path, because the bug was in which resolver gets to
 * the exception first, and only the real dispatcher decides that.
 */
@ExtendWith(OutputCaptureExtension.class)
class MalformedRequestIT extends IntegrationTestBase {

    // Test-only credential — not a real secret. pragma: allowlist secret
    private static final String TEST_PASSWORD = "Password1234";
    private static final String SUBDOMAIN = "malformed-studio";
    private static final String EMAIL = "owner@malformed-studio.test";

    @Autowired
    private TestRestTemplate rest;

    @BeforeEach
    void setup() {
        mockRedisNoLock();
        ResponseEntity<AuthResponse> registered = rest.postForEntity("/api/auth/register",
            new RegisterRequest("Owner", EMAIL, TEST_PASSWORD, SUBDOMAIN, "PHOTOGRAPHER", "STARTER", null),
            AuthResponse.class);
        assertThat(registered.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void aBodyThatIsNotJsonIs400AndNeverAnError(CapturedOutput log) {
        ResponseEntity<Map<String, Object>> resp =
            exchange(HttpMethod.POST, "/api/public/leads/" + SUBDOMAIN, "{\"name\": ", jsonHeaders());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).containsEntry("code", "MALFORMED_REQUEST");
        assertThat(resp.getBody()).doesNotContainKey("details");
        assertThat(countAcrossTenants("SELECT count(*) FROM leads")).isZero();
        assertThat(log.getAll()).doesNotContain("Unhandled exception");
    }

    /**
     * Well-formed JSON with a value Jackson cannot turn into the field's type.
     * The same path as an unknown enum constant. The field is named so the
     * form can mark it; the value is not echoed, because it is whatever the
     * caller typed, and that can be personal data.
     */
    @Test
    void aBodyValueOfTheWrongTypeIs400AndNamesTheField() {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "Emma Clarke");
        body.put("email", "emma@example.test");
        body.put("eventDate", "bogus-date");
        body.put("eventType", "WEDDING");

        ResponseEntity<Map<String, Object>> resp = exchange(
            HttpMethod.POST, "/api/public/leads/" + SUBDOMAIN, body, jsonHeaders());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).containsEntry("code", "MALFORMED_REQUEST");
        assertThat(resp.getBody()).containsEntry("details", Map.of("field", "eventDate"));
        assertThat(String.valueOf(resp.getBody().get("error"))).doesNotContain("bogus-date");
    }

    @Test
    void aPathIdThatIsNotAUuidIs400AndNamesTheParameter(CapturedOutput log) {
        ResponseEntity<Map<String, Object>> resp =
            exchange(HttpMethod.GET, "/api/clients/not-a-uuid", null, signedIn());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).containsEntry("code", "MALFORMED_REQUEST");
        assertThat(resp.getBody()).containsEntry("details", Map.of("field", "id"));
        assertThat(log.getAll()).doesNotContain("Unhandled exception");
    }

    @Test
    void aQueryDateThatIsNotADateIs400AndNamesTheParameter() {
        ResponseEntity<Map<String, Object>> resp = exchange(
            HttpMethod.GET, "/api/bookings/conflicts?eventDate=bogus", null, signedIn());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).containsEntry("code", "MALFORMED_REQUEST");
        assertThat(resp.getBody()).containsEntry("details", Map.of("field", "eventDate"));
    }

    @Test
    void aMissingRequiredParameterIs400AndNamesIt() {
        ResponseEntity<Map<String, Object>> resp =
            exchange(HttpMethod.GET, "/api/auth/subdomain-available", null, new HttpHeaders());

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).containsEntry("code", "MALFORMED_REQUEST");
        assertThat(resp.getBody()).containsEntry("details", Map.of("field", "subdomain"));
    }

    /** The {@code Accept} header is what Spring's own 415 sends, so a client can correct itself. */
    @Test
    void aBodyInAFormatTheEndpointDoesNotReadIs415() {
        HttpHeaders text = new HttpHeaders();
        text.setContentType(MediaType.TEXT_PLAIN);

        ResponseEntity<Map<String, Object>> resp =
            exchange(HttpMethod.POST, "/api/public/leads/" + SUBDOMAIN, "Emma Clarke", text);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        assertThat(resp.getBody()).containsEntry("code", "MALFORMED_REQUEST");
        assertThat(resp.getHeaders().getAccept()).contains(MediaType.APPLICATION_JSON);
    }

    private HttpHeaders signedIn() {
        ResponseEntity<AuthResponse> login = rest.postForEntity("/api/auth/login",
            new LoginRequest(EMAIL, TEST_PASSWORD), AuthResponse.class);
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(extractCookie(login, "access_token"));
        return headers;
    }

    private static HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }

    private ResponseEntity<Map<String, Object>> exchange(
        HttpMethod method, String path, Object body, HttpHeaders headers) {
        return rest.exchange(path, method, new HttpEntity<>(body, headers),
            new ParameterizedTypeReference<>() { });
    }
}
