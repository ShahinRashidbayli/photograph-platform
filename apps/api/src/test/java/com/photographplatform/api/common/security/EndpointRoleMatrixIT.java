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
    /**
     * Admitted by the filter chain like any other {@code permitAll} route, but
     * the handler itself needs a session and answers 401 without one —
     * {@code /api/auth/me}, the refresh handshake, resending a verification
     * mail. The distinction is real and worth keeping visible: authorization
     * lets these through, and the application decides.
     */
    private static final String PUBLIC_SESSION = "PUBLIC_REQUIRES_SESSION";

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

    private static void publicButRequiresSession(String endpoint) {
        EXPECTED.put(endpoint, Set.of(PUBLIC_SESSION));
    }

    static {
        staffOnly("GET /api/analytics");
        publicEndpoint("POST /api/auth/customer/login-code/request");
        publicEndpoint("POST /api/auth/customer/login-code/verify");
        publicEndpoint("POST /api/auth/login");
        publicEndpoint("POST /api/auth/logout");
        publicButRequiresSession("GET /api/auth/me");
        publicButRequiresSession("PATCH /api/auth/me");
        publicEndpoint("POST /api/auth/me/avatar/presign");
        publicEndpoint("POST /api/auth/password/forgot");
        publicEndpoint("POST /api/auth/password/reset");
        publicButRequiresSession("POST /api/auth/refresh");
        publicEndpoint("POST /api/auth/register");
        publicButRequiresSession("POST /api/auth/resend-verification");
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
        List<String> reachable = new ArrayList<>();
        for (String endpoint : registeredEndpoints()) {
            Set<String> allowed = EXPECTED.get(endpoint);
            if (allowed == null
                || allowed.contains(PUBLIC)
                || allowed.contains(PUBLIC_SESSION)
                || allowed.contains(ANY)
                || allowed.contains(CUSTOMER)) {
                continue;
            }
            Answer answer = call(endpoint, tokenFor(CUSTOMER));
            if (answer.status() != 403) {
                reachable.add(endpoint + " -> " + answer.status());
            }
        }

        assertThat(reachable)
            .as("A CUSTOMER token reached endpoints the role matrix does not grant it")
            .isEmpty();
    }

    /**
     * With no token at all, everything that is not {@code permitAll} must
     * answer 401 — not 403, and not the resource.
     *
     * <p>401 rather than 403 matters: the frontend's axios interceptor
     * refreshes on 401 and does not on 403, so an endpoint that answered 403 to
     * an expired session would leave the user stuck instead of signed back in.
     */
    @Test
    void anonymousIsRefusedEverythingThatIsNotPublic() {
        List<String> wrong = new ArrayList<>();
        for (String endpoint : registeredEndpoints()) {
            Set<String> allowed = EXPECTED.get(endpoint);
            if (allowed == null || allowed.contains(PUBLIC) || allowed.contains(PUBLIC_SESSION)) {
                continue;
            }
            Answer answer = call(endpoint, null);
            if (answer.status() != 401) {
                wrong.add(endpoint + " -> " + answer.status());
            }
        }

        assertThat(wrong)
            .as("Endpoints that are not public must answer 401 to an anonymous caller")
            .isEmpty();
    }

    /**
     * And the reverse: the public surface has to stay open.
     *
     * <p>`denyAll()` is one edit away from swallowing a permitAll matcher, and
     * the symptom would be a public portfolio page, a lead form or a Stripe
     * webhook that quietly stops working. What each handler then answers is its
     * own business — a webhook with no signature is a 400, a login with an empty
     * body a 422 — so only the two authorization answers are ruled out.
     */
    @Test
    void publicEndpointsStayOpenToAnonymousCallers() {
        List<String> closed = new ArrayList<>();
        for (String endpoint : registeredEndpoints()) {
            Set<String> allowed = EXPECTED.get(endpoint);
            boolean open = Set.of(PUBLIC).equals(allowed);
            boolean sessionScoped = Set.of(PUBLIC_SESSION).equals(allowed);
            if (!open && !sessionScoped) {
                continue;
            }
            Answer answer = call(endpoint, null);
            // A session-scoped route may answer 401 — that is its handler
            // talking, not the filter chain. Neither flavour may be refused
            // by authorization.
            boolean refused = answer.status() == 403 || (open && answer.status() == 401);
            if (refused) {
                closed.add(endpoint + " -> " + answer.status());
            }
        }

        assertThat(closed)
            .as("Public endpoints must not answer 401 or 403 to an anonymous caller")
            .isEmpty();
    }

    /**
     * Every role the matrix grants must actually get through.
     *
     * <p>This is the half a deny-by-default change can break silently: a rule
     * that is missing, misspelled or shadowed by an earlier matcher refuses the
     * people the feature is for, and no amount of "customers are refused"
     * testing notices.
     *
     * <p>Only an <em>authorization</em> 403 counts as a failure here. The same
     * status also comes back from the email-verification interceptor, which
     * these synthetic users trip because they do not exist in the database —
     * that one carries {@code code: EMAIL_NOT_VERIFIED} while the access-denied
     * handler answers {@code code: FORBIDDEN}. Distinguishing them is the whole
     * reason the API sends a code at all.
     */
    @Test
    void everyGrantedRoleIsLetThrough() {
        List<String> refused = new ArrayList<>();
        for (String endpoint : registeredEndpoints()) {
            for (String role : rolesToProbe(EXPECTED.get(endpoint))) {
                Answer answer = call(endpoint, tokenFor(role));
                if (answer.isAuthorizationDenial()) {
                    refused.add(endpoint + " as " + role);
                }
            }
        }

        assertThat(refused)
            .as("The role matrix grants these, but the filter chain refused them")
            .isEmpty();
    }

    /**
     * Where the matrix narrows an endpoint to ADMIN alone, a PHOTOGRAPHER must
     * not reach it.
     *
     * <p>There is no such endpoint today — every staff surface grants both — so
     * this asserts nothing yet and says so rather than pretending to. It is here
     * because the distinction is one someone will eventually draw, and the
     * moment they do the assertion starts running against it.
     */
    @Test
    void adminOnlyEndpointsAreClosedToPhotographers() {
        List<String> adminOnly = registeredEndpoints().stream()
            .filter(endpoint -> Set.of(ADMIN).equals(EXPECTED.get(endpoint)))
            .sorted()
            .toList();

        List<String> reachable = adminOnly.stream()
            .filter(endpoint -> call(endpoint, tokenFor(PHOTOGRAPHER)).status() != 403)
            .toList();

        assertThat(reachable)
            .as("ADMIN-only endpoints must refuse a PHOTOGRAPHER")
            .isEmpty();
    }

    /**
     * The roles worth sending at an endpoint: the ones the matrix grants, with
     * {@link #ANY} expanded to one staff role and one customer, since "any
     * authenticated caller" is only true if it holds for both.
     */
    private static Set<String> rolesToProbe(Set<String> allowed) {
        if (allowed == null || allowed.contains(PUBLIC) || allowed.contains(PUBLIC_SESSION)) {
            return Set.of();
        }
        if (allowed.contains(ANY)) {
            return Set.of(PHOTOGRAPHER, CUSTOMER);
        }
        return allowed;
    }

    private String tokenFor(String role) {
        return jwtService.generateToken(UUID.randomUUID(), UUID.randomUUID(), role);
    }

    /** What the chain answered, and enough of it to tell 403s apart. */
    private record Answer(int status, String body) {
        boolean isAuthorizationDenial() {
            return status == 403 && body != null && body.contains("\"code\":\"FORBIDDEN\"");
        }
    }

    private Answer call(String endpoint, String token) {
        String[] parts = endpoint.split(" ", 2);
        HttpMethod method = HttpMethod.valueOf(parts[0]);
        // Any syntactically valid id will do: authorization is decided in the
        // filter chain, before the handler ever looks the id up.
        String path = parts[1].replaceAll("\\{[^}]+}", UUID.randomUUID().toString());

        HttpHeaders headers = new HttpHeaders();
        if (token != null) {
            headers.setBearerAuth(token);
        }
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (method != HttpMethod.GET) {
            headers.add(HttpHeaders.COOKIE, "XSRF-TOKEN=" + CSRF_TOKEN);
            headers.add("X-XSRF-TOKEN", CSRF_TOKEN);
        }

        ResponseEntity<String> response = rest.exchange(
            path, method, new HttpEntity<>("{}", headers), String.class);
        return new Answer(response.getStatusCode().value(), response.getBody());
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
