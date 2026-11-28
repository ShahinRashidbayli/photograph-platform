package com.photographplatform.api.lead;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.RegisterRequest;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The Customer's language as the public request form submits it: through the
 * real HTTP path, validation included, into the {@code leads.language} column.
 *
 * <p>The form sends its current UI language. Every Customer message about the
 * lead, and about the booking it becomes, is written in it, so a value that
 * is silently dropped or coerced would answer an English-speaking Customer in
 * German without anyone noticing.
 */
class PublicLeadLanguageIT extends IntegrationTestBase {

    // Test-only credential — not a real secret. pragma: allowlist secret
    private static final String TEST_PASSWORD = "Password1234";
    private static final String SUBDOMAIN = "language-studio";

    @Autowired
    private TestRestTemplate rest;

    @BeforeEach
    void setup() {
        mockRedisNoLock();
        ResponseEntity<AuthResponse> registered = rest.postForEntity("/api/auth/register",
            new RegisterRequest("Owner", "owner@language-studio.test", TEST_PASSWORD, SUBDOMAIN,
                "PHOTOGRAPHER", "STARTER", null),
            AuthResponse.class);
        assertThat(registered.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void aLeadSubmittedInEnglishIsStoredAndReadBackAsEnglish() {
        ResponseEntity<Map<String, Object>> resp = submitLead("en");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).containsEntry("language", "en");
        assertThat(storedLanguage(resp)).isEqualTo("en");
    }

    @Test
    void aLeadSubmittedWithoutALanguageIsGerman() {
        // A form deployed before the field existed sends nothing; that must
        // still be accepted, as the studios' own language.
        ResponseEntity<Map<String, Object>> resp = submitLead(null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).containsEntry("language", "de");
        assertThat(storedLanguage(resp)).isEqualTo("de");
    }

    /**
     * Refused like every other invalid field of this API: 422 with
     * {@code VALIDATION_FAILED} and the field named, so the form can mark it
     * (see {@code GlobalExceptionHandler#handleValidation}). The ticket said
     * 400; a second status for one field would be a second way of doing it.
     */
    @Test
    void aLanguageOtherThanGermanOrEnglishIsRefusedAndStoresNothing() {
        ResponseEntity<Map<String, Object>> resp = submitLead("fr");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(resp.getBody()).containsEntry("code", "VALIDATION_FAILED");
        assertThat(String.valueOf(resp.getBody().get("error"))).startsWith("language:");
        assertThat(countAcrossTenants("SELECT count(*) FROM leads")).isZero();
    }

    private ResponseEntity<Map<String, Object>> submitLead(String language) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "Emma Clarke");
        body.put("email", "emma@example.test");
        body.put("eventDate", LocalDate.now().plusDays(90).toString());
        body.put("eventType", "WEDDING");
        body.put("budgetRange", "1000_2000");
        body.put("language", language);
        return rest.exchange("/api/public/leads/" + SUBDOMAIN, HttpMethod.POST,
            new HttpEntity<>(body), new ParameterizedTypeReference<>() { });
    }

    private String storedLanguage(ResponseEntity<Map<String, Object>> created) {
        return valueAcrossTenants("SELECT language FROM leads WHERE id = ?::uuid",
            created.getBody().get("id"));
    }
}
