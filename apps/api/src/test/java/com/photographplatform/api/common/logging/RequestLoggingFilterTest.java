package com.photographplatform.api.common.logging;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.slf4j.event.KeyValuePair;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.servlet.HandlerMapping;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The request id every line of a request shares, and the one access line each
 * request leaves behind. That the line names a route and never a URI is the
 * reason this filter exists in its shape — the Customer's gallery link carries
 * its access token in the path.
 */
class RequestLoggingFilterTest {

    private static final String GALLERY_TOKEN = "k3Jx9-secret-gallery-token";
    private static final String GALLERY_ROUTE = "/api/public/galleries/{subdomain}/{token}";

    private final RequestLoggingFilter filter = new RequestLoggingFilter();
    private final ListAppender<ILoggingEvent> lines = new ListAppender<>();
    private final Logger logger = (Logger) LoggerFactory.getLogger(RequestLoggingFilter.class);

    @BeforeEach
    void captureLines() {
        lines.start();
        logger.addAppender(lines);
    }

    @AfterEach
    void releaseLines() {
        logger.detachAppender(lines);
        MDC.clear();
    }

    @Test
    void everyRequestGetsAnIdThatIsLoggedUnderAndReturned() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/bookings");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> idInsideTheChain = new AtomicReference<>();

        filter.doFilter(request, response, (req, res) -> idInsideTheChain.set(MDC.get(LogFields.REQUEST_ID)));

        assertThat(idInsideTheChain.get()).isNotBlank();
        assertThat(response.getHeader(RequestId.RESPONSE_HEADER)).isEqualTo(idInsideTheChain.get());
        assertThat(onlyLine().getMDCPropertyMap()).containsEntry(LogFields.REQUEST_ID, idInsideTheChain.get());
        assertThat(MDC.get(LogFields.REQUEST_ID)).as("left behind on a pooled thread").isNull();
    }

    @Test
    void railwaysRequestIdIsReusedSoBothLogsFindTheSameRequest() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/bookings");
        request.addHeader(RequestId.RAILWAY_HEADER, "rw_8fK2pQ-1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> { });

        assertThat(response.getHeader(RequestId.RESPONSE_HEADER)).isEqualTo("rw_8fK2pQ-1");
    }

    @Test
    void theGalleryTokenInThePathNeverReachesTheLine() throws Exception {
        MockHttpServletRequest request =
            new MockHttpServletRequest("GET", "/api/public/galleries/atelier/" + GALLERY_TOKEN);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) ->
            req.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, GALLERY_ROUTE));

        ILoggingEvent line = onlyLine();
        assertThat(fields(line))
            .containsEntry(LogFields.HTTP_METHOD, "GET")
            .containsEntry(LogFields.ROUTE, GALLERY_ROUTE)
            .containsEntry(LogFields.STATUS, 200)
            .containsKey(LogFields.DURATION_MS);
        assertThat(line.getFormattedMessage()).isEqualTo("GET " + GALLERY_ROUTE + " -> 200 in "
            + fields(line).get(LogFields.DURATION_MS) + " ms");
        assertThat(line.getFormattedMessage() + fields(line)).doesNotContain(GALLERY_TOKEN, "atelier");
    }

    @Test
    void aRequestNoControllerClaimedIsLoggedAsUnmatched() throws Exception {
        MockHttpServletRequest turnedAway = new MockHttpServletRequest("GET", "/api/bookings");
        MockHttpServletRequest unknownPath = new MockHttpServletRequest("GET", "/api/nope/" + GALLERY_TOKEN);

        filter.doFilter(turnedAway, new MockHttpServletResponse(), (req, res) ->
            ((MockHttpServletResponse) res).setStatus(401));
        filter.doFilter(unknownPath, new MockHttpServletResponse(), (req, res) -> {
            // What the static-resource handler leaves behind for a path nobody maps.
            req.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/**");
            ((MockHttpServletResponse) res).setStatus(404);
        });

        assertThat(lines.list).extracting(line -> fields(line).get(LogFields.ROUTE))
            .containsExactly(RequestRoute.UNMATCHED, RequestRoute.UNMATCHED);
        assertThat(lines.list).extracting(line -> fields(line).get(LogFields.STATUS))
            .containsExactly(401, 404);
    }

    @Test
    void theLineNamesTheTenantAndUserTheSecurityChainFound() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/bookings");

        filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            req.setAttribute(RequestLoggingFilter.TENANT_ID_ATTRIBUTE, "tenant-1");
            req.setAttribute(RequestLoggingFilter.USER_ID_ATTRIBUTE, "user-1");
        });

        assertThat(fields(onlyLine()))
            .containsEntry(LogFields.TENANT_ID, "tenant-1")
            .containsEntry(LogFields.USER_ID, "user-1");
    }

    @Test
    void anAnonymousRequestCarriesNoTenantOrUserFieldsAtAll() throws Exception {
        filter.doFilter(new MockHttpServletRequest("GET", "/api/public/x"), new MockHttpServletResponse(),
            (req, res) -> { });

        assertThat(fields(onlyLine())).doesNotContainKeys(LogFields.TENANT_ID, LogFields.USER_ID);
    }

    @Test
    void anExceptionEscapingTheChainIsLoggedAsTheServerErrorItBecomes() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/bookings");

        assertThatThrownBy(() -> filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            throw new IllegalStateException("boom");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(fields(onlyLine())).containsEntry(LogFields.STATUS, 500);
        assertThat(MDC.get(LogFields.REQUEST_ID)).isNull();
    }

    @Test
    void healthChecksAreLeftOut() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(new MockHttpServletRequest("GET", "/actuator/health"), response, (req, res) -> { });

        assertThat(lines.list).isEmpty();
    }

    @Test
    void aStreamedResponseIsLoggedOnceItCompletesWithItsFinalStatus() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/public/galleries/a/b/download");
        request.setAsyncSupported(true);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> req.startAsync());
        assertThat(lines.list).as("still streaming").isEmpty();
        String requestId = response.getHeader(RequestId.RESPONSE_HEADER);

        response.setStatus(200);
        request.getAsyncContext().complete();

        ILoggingEvent line = onlyLine();
        assertThat(fields(line)).containsEntry(LogFields.STATUS, 200);
        assertThat(line.getMDCPropertyMap()).containsEntry(LogFields.REQUEST_ID, requestId);
        assertThat(MDC.get(LogFields.REQUEST_ID)).isNull();
    }

    private ILoggingEvent onlyLine() {
        assertThat(lines.list).hasSize(1);
        return lines.list.get(0);
    }

    private static Map<String, Object> fields(ILoggingEvent line) {
        Map<String, Object> fields = new HashMap<>();
        if (line.getKeyValuePairs() != null) {
            for (KeyValuePair pair : line.getKeyValuePairs()) {
                fields.put(pair.key, pair.value);
            }
        }
        return fields;
    }
}
