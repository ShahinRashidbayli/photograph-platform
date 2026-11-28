package com.photographplatform.api.client;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.dto.AuthResponse;
import com.photographplatform.api.auth.dto.LoginRequest;
import com.photographplatform.api.auth.dto.RegisterRequest;
import com.photographplatform.api.client.dto.ClientDetailResponse;
import com.photographplatform.api.client.dto.ClientResponse;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression for the empty client directory: a booking created through the
 * API must make its client appear in {@code GET /api/clients}, with no
 * further step. Before V41 the directory read a table that nothing wrote, so
 * this returned {@code []} for every real studio.
 */
class ClientDirectoryIT extends IntegrationTestBase {

    // Test-only credential — not a real secret. pragma: allowlist secret
    private static final String TEST_PASSWORD = "Password1234";
    private static final String CSRF_TOKEN = "client-directory-csrf-token";

    @Autowired
    private TestRestTemplate rest;

    @BeforeEach
    void setup() {
        mockRedisNoLock();
    }

    @Test
    void aBookingCreatedThroughTheApiAppearsInTheDirectory() {
        String token = registerStudio();

        ResponseEntity<String> created = rest.exchange("/api/bookings", HttpMethod.POST, new HttpEntity<>(Map.of(
            "clientName", "Maria Kellner",
            "clientEmail", "Maria.Kellner@Example.test",
            "eventDate", LocalDate.now().plusDays(30).toString()), headers(token, true)), String.class);
        assertThat(created.getStatusCode().is2xxSuccessful()).as(created.getBody()).isTrue();

        ResponseEntity<ClientResponse[]> clients = rest.exchange(
            "/api/clients", HttpMethod.GET, new HttpEntity<>(headers(token, false)), ClientResponse[].class);

        assertThat(clients.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(clients.getBody()).singleElement().satisfies(c -> {
            assertThat(c.fullName()).isEqualTo("Maria Kellner");
            assertThat(c.email()).isEqualTo("maria.kellner@example.test");
            assertThat(c.totalBookings()).isEqualTo(1);
            assertThat(c.upcomingBookings()).isEqualTo(1);
        });
    }

    @Test
    void aClientsDetailListsTheirBookings() {
        String token = registerStudio();
        ResponseEntity<Map> created = rest.exchange("/api/bookings", HttpMethod.POST, new HttpEntity<>(Map.of(
            "clientName", "Maria Kellner",
            "clientEmail", "maria.kellner@example.test",
            "eventDate", LocalDate.now().plusDays(30).toString()), headers(token, true)), Map.class);
        assertThat(created.getStatusCode().is2xxSuccessful()).as(String.valueOf(created.getBody())).isTrue();
        UUID clientId = rest.exchange("/api/clients", HttpMethod.GET, new HttpEntity<>(headers(token, false)),
            ClientResponse[].class).getBody()[0].id();

        ResponseEntity<ClientDetailResponse> detail = rest.exchange("/api/clients/" + clientId, HttpMethod.GET,
            new HttpEntity<>(headers(token, false)), ClientDetailResponse.class);

        assertThat(detail.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(detail.getBody().client().fullName()).isEqualTo("Maria Kellner");
        assertThat(detail.getBody().bookings()).singleElement()
            .satisfies(b -> assertThat(b.id().toString()).isEqualTo(created.getBody().get("id")));
        assertThat(detail.getBody().galleries()).isEmpty();
        assertThat(detail.getBody().invoices()).isEmpty();
        assertThat(detail.getBody().contracts()).isEmpty();
    }

    @Test
    void anUnknownClientIsNotFound() {
        String token = registerStudio();

        ResponseEntity<String> detail = rest.exchange("/api/clients/" + UUID.randomUUID(), HttpMethod.GET,
            new HttpEntity<>(headers(token, false)), String.class);

        assertThat(detail.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void aConvertedLeadAppearsInTheDirectory() {
        String token = registerStudio();
        // Manual lead entry and conversion are gated on a verified address.
        executeAcrossTenants(
            "UPDATE users SET email_verified_at = now() "
                + "WHERE email LIKE 'owner-%@example.test' AND email_verified_at IS NULL");

        ResponseEntity<Map> lead = rest.exchange("/api/leads", HttpMethod.POST, new HttpEntity<>(Map.of(
            "name", "Jonas Berg",
            "email", "Jonas.Berg@Example.test",
            "phone", "+49 170 1234567",
            "eventDate", LocalDate.now().plusDays(60).toString(),
            "eventType", "Hochzeit",
            "budgetRange", "2000-3000"), headers(token, true)), Map.class);
        assertThat(lead.getStatusCode().is2xxSuccessful()).as(String.valueOf(lead.getBody())).isTrue();

        ResponseEntity<String> converted = rest.exchange(
            "/api/leads/" + lead.getBody().get("id") + "/convert", HttpMethod.POST,
            new HttpEntity<>(Map.of(), headers(token, true)), String.class);
        assertThat(converted.getStatusCode().is2xxSuccessful()).as(converted.getBody()).isTrue();

        ResponseEntity<ClientResponse[]> clients = rest.exchange(
            "/api/clients", HttpMethod.GET, new HttpEntity<>(headers(token, false)), ClientResponse[].class);

        assertThat(clients.getBody()).singleElement().satisfies(c -> {
            assertThat(c.fullName()).isEqualTo("Jonas Berg");
            assertThat(c.email()).isEqualTo("jonas.berg@example.test");
            assertThat(c.totalBookings()).isEqualTo(1);
            // Bookings hold no phone; the lead the booking came from does.
            assertThat(c.phone()).isEqualTo("+49 170 1234567");
        });
    }

    private String registerStudio() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String email = "owner-" + suffix + "@example.test";
        rest.postForEntity("/api/auth/register",
            new RegisterRequest("Anna", email, TEST_PASSWORD, "studio-" + suffix, "PHOTOGRAPHER", "STARTER", null),
            AuthResponse.class);
        ResponseEntity<AuthResponse> login = rest.postForEntity("/api/auth/login",
            new LoginRequest(email, TEST_PASSWORD), AuthResponse.class);
        return extractCookie(login, "access_token");
    }

    private static HttpHeaders headers(String token, boolean write) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);
        if (write) {
            h.add(HttpHeaders.COOKIE, "XSRF-TOKEN=" + CSRF_TOKEN);
            h.add("X-XSRF-TOKEN", CSRF_TOKEN);
        }
        return h;
    }
}
