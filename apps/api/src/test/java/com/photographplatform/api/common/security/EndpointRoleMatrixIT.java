package com.photographplatform.api.common.security;

import com.photographplatform.api.IntegrationTestBase;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The role matrix, asserted against the routes the application actually
 * registers rather than against a list someone maintains by hand.
 *
 * <p>This exists because of how BUG-002..005 and BUG-008 happened.
 * {@code SecurityConfig} is one ordered allow-list that used to end in
 * {@code anyRequest().authenticated()}, so a controller whose path prefix
 * nobody had written a rule for did not fail — it quietly inherited "any
 * logged-in role". Four prefixes drifted in that way ({@code /api/tenant},
 * {@code /api/team}, {@code /api/resources}, {@code /api/analytics}), and a
 * CUSTOMER — who holds a perfectly valid JWT for the photographer's own tenant
 * — could read the staff roster and the studio's revenue, and rewrite the
 * legally-required Impressum. Nothing failed, because nothing was looking.
 *
 * <p>So the check is not "is there a rule" but "does the rule say what we
 * meant". {@link #EXPECTED} is the intent, one line per endpoint, and the two
 * tests below close both directions of the gap:
 *
 * <ul>
 *   <li>{@link #everyRegisteredEndpointIsInTheMatrix()} — a new endpoint that
 *       nobody classified fails the build. This is the part that would have
 *       caught the original drift: the endpoints existed, the intent was never
 *       written down, and the default was generous.</li>
 *   <li>{@link #aCustomerIsRefusedEverythingNotMeantForThem()} — a real
 *       CUSTOMER token is sent, over the real filter chain, at every endpoint
 *       the matrix does not grant to CUSTOMER, and must be refused.</li>
 * </ul>
 *
 * <p>The positive direction (a photographer is <em>not</em> refused) is left to
 * the rest of the suite: the per-controller {@code *SecurityRuleTest} classes
 * assert it precisely, and here it would collide with the email-verification
 * interceptor and the plan gate, which answer 403 and 402 for reasons that have
 * nothing to do with roles.
 *
 * <p>Mutating requests carry the CSRF header. Without it the filter would
 * answer 403 before authorization ran and every assertion below would pass for
 * the wrong reason.
 */
class EndpointRoleMatrixIT extends IntegrationTestBase {

    /** Any authenticated caller, whatever their role. */
    private static final String ANY = "ANY_AUTHENTICATED";
    /** No token needed at all. */
    private static final String PUBLIC = "PUBLIC";

    private static final String PHOTOGRAPHER = "PHOTOGRAPHER";
    private static final String ADMIN = "ADMIN";
    private static final String CUSTOMER = "CUSTOMER";

    /**
     * Endpoint to the roles that may reach it. Keyed {@code "VERB /pattern"},
     * with the pattern spelled exactly as the controller declares it.
     */
    private static final Map<String, Set<String>> EXPECTED = new LinkedHashMap<>();

    private static void staffOnly(String endpoint) {
        EXPECTED.put(endpoint, Set.of(PHOTOGRAPHER, ADMIN));
    }

    private static void staffOrCustomer(String endpoint) {
        EXPECTED.put(endpoint, Set.of(PHOTOGRAPHER, ADMIN, CUSTOMER));
    }

    private static void customerOnly(String endpoint) {
        EXPECTED.put(endpoint, Set.of(CUSTOMER));
    }

    private static void anyAuthenticated(String endpoint) {
        EXPECTED.put(endpoint, Set.of(ANY));
    }

    private static void publicEndpoint(String endpoint) {
        EXPECTED.put(endpoint, Set.of(PUBLIC));
    }

    static {
        staffOnly("GET /api/analytics");
        publicEndpoint("POST /api/auth/customer/login-code/request");
        publicEndpoint("POST /api/auth/customer/login-code/verify");
        publicEndpoint("POST /api/auth/login");
        publicEndpoint("POST /api/auth/logout");
        publicEndpoint("GET /api/auth/me");
        publicEndpoint("PATCH /api/auth/me");
        publicEndpoint("POST /api/auth/me/avatar/presign");
        publicEndpoint("POST /api/auth/password/forgot");
        publicEndpoint("POST /api/auth/password/reset");
        publicEndpoint("POST /api/auth/refresh");
        publicEndpoint("POST /api/auth/register");
        publicEndpoint("POST /api/auth/resend-verification");
        publicEndpoint("GET /api/auth/subdomain-available");
        publicEndpoint("POST /api/auth/verify-email");
        staffOnly("GET /api/billing");
        staffOnly("POST /api/billing/checkout");
        staffOnly("POST /api/billing/dev-plan");
        staffOnly("POST /api/billing/portal");
        staffOnly("POST /api/bookings");
        staffOnly("GET /api/bookings/conflicts");
        staffOnly("GET /api/bookings/{bookingId}/contracts");
        staffOnly("POST /api/bookings/{bookingId}/contracts");
        staffOnly("GET /api/bookings/{bookingId}/invoices");
        staffOnly("POST /api/bookings/{bookingId}/invoices");
        staffOnly("PATCH /api/bookings/{id}");
        staffOnly("PATCH /api/bookings/{id}/status");
        staffOnly("GET /api/clients");
        staffOnly("PATCH /api/clients/{id}/notes");
        staffOnly("GET /api/contracts");
        staffOnly("GET /api/contracts/{id}");
        staffOnly("PUT /api/contracts/{id}");
        staffOnly("POST /api/contracts/{id}/cancel");
        staffOnly("GET /api/contracts/{id}/pdf");
        staffOnly("POST /api/contracts/{id}/send");
        customerOnly("GET /api/customer/contracts");
        customerOnly("GET /api/customer/contracts/{id}");
        customerOnly("GET /api/customer/contracts/{id}/pdf");
        customerOnly("POST /api/customer/contracts/{id}/sign");
        customerOnly("GET /api/customer/inquiry-requests");
        customerOnly("POST /api/customer/inquiry-requests");
        customerOnly("GET /api/customer/invoices");
        anyAuthenticated("GET /api/customerBookings");
        anyAuthenticated("GET /api/entitlements");
        staffOnly("GET /api/galleries");
        staffOnly("POST /api/galleries");
        staffOnly("DELETE /api/galleries/photos/{photoId}");
        staffOnly("POST /api/galleries/photos/{photoId}/complete");
        staffOnly("DELETE /api/galleries/{id}");
        staffOnly("PATCH /api/galleries/{id}");
        staffOnly("POST /api/galleries/{id}/extend");
        staffOnly("GET /api/galleries/{id}/photos");
        staffOnly("POST /api/galleries/{id}/photos/initiate-upload");
        staffOnly("GET /api/inquiries");
        staffOnly("PATCH /api/inquiries/{id}/status");
        staffOnly("GET /api/invoices/export.datev.csv");
        staffOnly("GET /api/invoices/{id}");
        staffOnly("POST /api/invoices/{id}/storno");
        staffOrCustomer("GET /api/invoices/{invoiceId}/payments");
        staffOrCustomer("POST /api/invoices/{invoiceId}/payments/intent");
        staffOnly("POST /api/invoices/{invoiceId}/payments/manual");
        staffOnly("GET /api/leads");
        staffOnly("POST /api/leads");
        staffOnly("GET /api/leads/export.csv");
        staffOnly("PATCH /api/leads/{id}");
        staffOnly("GET /api/leads/{id}/activity");
        staffOnly("POST /api/leads/{id}/convert");
        staffOnly("PATCH /api/leads/{id}/notes");
        staffOnly("PATCH /api/leads/{id}/status");
        staffOnly("GET /api/packages");
        staffOnly("POST /api/packages");
        staffOnly("DELETE /api/packages/{id}");
        staffOnly("GET /api/packages/{id}");
        staffOnly("PUT /api/packages/{id}");
        staffOnly("GET /api/photographerBookings");
        staffOnly("GET /api/portfolio/categories");
        staffOnly("POST /api/portfolio/categories");
        staffOnly("DELETE /api/portfolio/categories/{id}");
        staffOnly("PATCH /api/portfolio/categories/{id}");
        staffOnly("GET /api/portfolio/photos");
        staffOnly("POST /api/portfolio/photos/initiate-upload");
        staffOnly("DELETE /api/portfolio/photos/{id}");
        staffOnly("PATCH /api/portfolio/photos/{id}/category");
        staffOnly("POST /api/portfolio/photos/{id}/complete");
        staffOnly("POST /api/portfolio/photos/{id}/publish");
        staffOnly("POST /api/portfolio/photos/{id}/unpublish");
        publicEndpoint("GET /api/public/galleries/{subdomain}/{token}");
        publicEndpoint("GET /api/public/galleries/{subdomain}/{token}/download");
        publicEndpoint("GET /api/public/invitations");
        publicEndpoint("POST /api/public/invitations/accept");
        publicEndpoint("POST /api/public/leads/{subdomain}");
        publicEndpoint("GET /api/public/legal/{subdomain}");
        publicEndpoint("GET /api/public/portfolio/{subdomain}");
        publicEndpoint("POST /api/public/webhooks/stripe");
        publicEndpoint("POST /api/public/webhooks/stripe/billing");
        staffOnly("GET /api/resources");
        staffOnly("POST /api/resources");
        staffOnly("PUT /api/resources/{id}");
        staffOnly("GET /api/roadmap/interest");
        staffOnly("DELETE /api/roadmap/interest/{feature}");
        staffOnly("PUT /api/roadmap/interest/{feature}");
        staffOnly("GET /api/settings/billing-profile");
        staffOnly("PUT /api/settings/billing-profile");
        staffOnly("GET /api/settings/branding");
        staffOnly("PUT /api/settings/branding");
        staffOnly("POST /api/settings/branding/logo/presign");
        staffOnly("GET /api/settings/stripe");
        staffOnly("POST /api/settings/stripe/onboarding-link");
        staffOnly("POST /api/settings/stripe/refresh");
        staffOnly("GET /api/team");
        staffOnly("POST /api/team/invitations");
        staffOnly("DELETE /api/team/invitations/{id}");
        staffOnly("POST /api/team/leave");
        staffOnly("DELETE /api/team/members/{id}");
        staffOnly("POST /api/team/transfer-ownership");
        staffOnly("GET /api/tenant/legal");
        staffOnly("PUT /api/tenant/legal");
    }

    // Qualified: actuator contributes a second RequestMappingHandlerMapping
    // (controllerEndpointHandlerMapping) and only the application's own
    // mapping is being audited here.
    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping handlerMapping;

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private JwtService jwtService;

    /**
     * Every route the application registers must appear in {@link #EXPECTED}.
     *
     * <p>Adding a controller method is therefore a decision about who may call
     * it, taken at the moment it is written, instead of a default inherited
     * from whichever matcher happens to sit above it.
     */
    @Test
    void everyRegisteredEndpointIsInTheMatrix() {
        List<String> registered = registeredEndpoints();

        List<String> unclassified = registered.stream()
            .filter(endpoint -> !EXPECTED.containsKey(endpoint))
            .sorted()
            .toList();

        assertThat(unclassified)
            .as("""
                New endpoints are not covered by the role matrix in \
                EndpointRoleMatrixIT. Add each one with the roles that may \
                reach it, and add the matching rule to SecurityConfig — \
                anyRequest() is denyAll(), so an unruled endpoint is \
                unreachable rather than public, but the intent still has to \
                be written down here.""")
            .isEmpty();

        List<String> stale = EXPECTED.keySet().stream()
            .filter(endpoint -> !registered.contains(endpoint))
            .sorted()
            .toList();

        assertThat(stale)
            .as("The matrix lists endpoints the application no longer serves")
            .isEmpty();
    }

    /**
     * A CUSTOMER token is a valid token for the photographer's tenant, so every
     * endpoint the matrix does not grant to CUSTOMER has to refuse it.
     */
    @Test
    void aCustomerIsRefusedEverythingNotMeantForThem() {
        String token = jwtService.generateToken(UUID.randomUUID(), UUID.randomUUID(), CUSTOMER);

        List<String> reachable = new ArrayList<>();
        for (String endpoint : registeredEndpoints()) {
            Set<String> allowed = EXPECTED.get(endpoint);
            if (allowed == null
                || allowed.contains(PUBLIC)
                || allowed.contains(ANY)
                || allowed.contains(CUSTOMER)) {
                continue;
            }
            int status = callAsCustomer(endpoint, token);
            if (status != 403) {
                reachable.add(endpoint + " -> " + status);
            }
        }

        assertThat(reachable)
            .as("A CUSTOMER token reached endpoints the role matrix does not grant it")
            .isEmpty();
    }

    private int callAsCustomer(String endpoint, String token) {
        String[] parts = endpoint.split(" ", 2);
        HttpMethod method = HttpMethod.valueOf(parts[0]);
        // Any syntactically valid id will do: authorization is decided in the
        // filter chain, before the handler ever looks the id up.
        String path = parts[1].replaceAll("\\{[^}]+}", UUID.randomUUID().toString());

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (method != HttpMethod.GET) {
            headers.add(HttpHeaders.COOKIE, "XSRF-TOKEN=" + CSRF_TOKEN);
            headers.add("X-XSRF-TOKEN", CSRF_TOKEN);
        }

        ResponseEntity<String> response = rest.exchange(
            path, method, new HttpEntity<>("{}", headers), String.class);
        return response.getStatusCode().value();
    }

    private static final String CSRF_TOKEN = "endpoint-matrix-csrf-token";

    private List<String> registeredEndpoints() {
        List<String> endpoints = new ArrayList<>();
        for (RequestMappingInfo info : handlerMapping.getHandlerMethods().keySet()) {
            Set<String> patterns = patternsOf(info);
            Set<HttpMethod> methods = new LinkedHashSet<>();
            info.getMethodsCondition().getMethods()
                .forEach(m -> methods.add(HttpMethod.valueOf(m.name())));
            for (String pattern : patterns) {
                // Spring registers its own error and actuator handlers in the
                // same mapping; only this application's API is being audited.
                if (!pattern.startsWith("/api/")) {
                    continue;
                }
                for (HttpMethod method : methods) {
                    endpoints.add(method.name() + " " + pattern);
                }
            }
        }
        return endpoints;
    }

    private static Set<String> patternsOf(RequestMappingInfo info) {
        if (info.getPathPatternsCondition() != null) {
            Set<String> patterns = new LinkedHashSet<>();
            info.getPathPatternsCondition().getPatterns()
                .forEach(p -> patterns.add(p.getPatternString()));
            return patterns;
        }
        return info.getPatternValues();
    }
}
