package com.photographplatform.api.inquiry;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.domain.User;
import com.photographplatform.api.auth.repository.UserRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.security.JwtService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.repository.TenantRepository;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The Customer's language as the portal's request form submits it: through
 * the real HTTP path with a CUSTOMER token, validation included, into the
 * {@code inquiry_requests.language} column. The sibling of
 * {@code PublicLeadLanguageIT} for the signed-in form.
 */
class CustomerInquiryLanguageIT extends IntegrationTestBase {

    private static final String CSRF_TOKEN = "customer-inquiry-language-csrf";

    @Autowired private TestRestTemplate rest;
    @Autowired private JwtService jwtService;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PlatformTransactionManager txManager;

    private String customerToken;

    @BeforeEach
    void setup() {
        mockRedisNoLock();
        UUID tenantId = new TransactionTemplate(txManager).execute(s -> tenantRepository.save(
            new Tenant("inquiry-language-" + UUID.randomUUID(),
                "owner-" + UUID.randomUUID() + "@example.test")).getId());
        TenantContext.setTenant(tenantId.toString());
        try {
            UUID customerId = new TransactionTemplate(txManager).execute(s -> {
                User customer = new User(tenantId, "emma-" + UUID.randomUUID() + "@example.test",
                    "hash", "Emma Clarke");
                customer.setRole("CUSTOMER");
                return userRepository.save(customer).getId();
            });
            customerToken = jwtService.generateToken(customerId, tenantId, "CUSTOMER");
        } finally {
            TenantContext.clear();
        }
    }

    @Test
    void anInquirySubmittedInEnglishIsStoredAndReadBackAsEnglish() {
        ResponseEntity<Map<String, Object>> resp = submitInquiry("en");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).containsEntry("language", "en");
        assertThat(storedLanguage(resp)).isEqualTo("en");
    }

    @Test
    void anInquirySubmittedWithoutALanguageIsGerman() {
        ResponseEntity<Map<String, Object>> resp = submitInquiry(null);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(resp.getBody()).containsEntry("language", "de");
        assertThat(storedLanguage(resp)).isEqualTo("de");
    }

    /** Refused with the API's validation status, as in {@code PublicLeadLanguageIT}. */
    @Test
    void aLanguageOtherThanGermanOrEnglishIsRefusedAndStoresNothing() {
        ResponseEntity<Map<String, Object>> resp = submitInquiry("fr");

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(resp.getBody()).containsEntry("code", "VALIDATION_FAILED");
        assertThat(String.valueOf(resp.getBody().get("error"))).startsWith("language:");
        assertThat(countAcrossTenants("SELECT count(*) FROM inquiry_requests")).isZero();
    }

    private ResponseEntity<Map<String, Object>> submitInquiry(String language) {
        Map<String, Object> body = new HashMap<>();
        body.put("eventType", "PORTRAIT");
        body.put("budgetRange", "500_1000");
        body.put("proposedDate", LocalDate.now().plusDays(60).toString());
        body.put("language", language);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(customerToken);
        headers.add(HttpHeaders.COOKIE, "XSRF-TOKEN=" + CSRF_TOKEN);
        headers.add("X-XSRF-TOKEN", CSRF_TOKEN);
        return rest.exchange("/api/customer/inquiry-requests", HttpMethod.POST,
            new HttpEntity<>(body, headers), new ParameterizedTypeReference<>() { });
    }

    private String storedLanguage(ResponseEntity<Map<String, Object>> created) {
        return valueAcrossTenants("SELECT language FROM inquiry_requests WHERE id = ?::uuid",
            created.getBody().get("id"));
    }
}
