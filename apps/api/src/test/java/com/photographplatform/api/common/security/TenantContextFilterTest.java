package com.photographplatform.api.common.security;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.logging.LogFields;
import com.photographplatform.api.common.logging.RequestLoggingFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class TenantContextFilterTest {

    private final TenantContextFilter filter = new TenantContextFilter();

    @BeforeEach
    @AfterEach
    void resetState() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @Test
    void unauthenticatedRequestPassesThroughEvenWithoutTenant() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain, times(1)).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
    }

    @Test
    void anonymousAuthenticationIsTreatedAsUnauthenticated() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
            new AnonymousAuthenticationToken(
                "key", "anonymous",
                List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))
            )
        );
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain, times(1)).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
    }

    @Test
    void authenticatedRequestWithTenantPassesThrough() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                "user-id", null,
                List.of(new SimpleGrantedAuthority("ROLE_PHOTOGRAPHER"))
            )
        );
        TenantContext.setTenant("00000000-0000-0000-0000-000000000001");

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain, times(1)).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
    }

    @Test
    void theRequestsLinesNameItsTenantAndUserAndTheAccessLineCanToo() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                "user-id", null,
                List.of(new SimpleGrantedAuthority("ROLE_PHOTOGRAPHER"))
            )
        );
        TenantContext.setTenant("00000000-0000-0000-0000-000000000001");
        MockHttpServletRequest request = new MockHttpServletRequest();
        AtomicReference<Map<String, String>> logContext = new AtomicReference<>();

        filter.doFilter(request, new MockHttpServletResponse(),
            (req, res) -> logContext.set(MDC.getCopyOfContextMap()));

        assertThat(logContext.get())
            .containsEntry(LogFields.TENANT_ID, "00000000-0000-0000-0000-000000000001")
            .containsEntry(LogFields.USER_ID, "user-id");
        assertThat(MDC.getCopyOfContextMap()).as("cleared for the pooled thread").isNullOrEmpty();
        // The access line is written after this filter clears the log context.
        assertThat(request.getAttribute(RequestLoggingFilter.TENANT_ID_ATTRIBUTE))
            .isEqualTo("00000000-0000-0000-0000-000000000001");
        assertThat(request.getAttribute(RequestLoggingFilter.USER_ID_ATTRIBUTE)).isEqualTo("user-id");
    }

    @Test
    void anAnonymousRequestNamesNoUser() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        AtomicReference<Map<String, String>> logContext = new AtomicReference<>();

        filter.doFilter(request, new MockHttpServletResponse(),
            (req, res) -> logContext.set(MDC.getCopyOfContextMap()));

        assertThat(logContext.get()).isNullOrEmpty();
        assertThat(request.getAttribute(RequestLoggingFilter.USER_ID_ATTRIBUTE)).isNull();
    }

    @Test
    void authenticatedRequestWithoutTenantIsRejected() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                "user-id", null,
                List.of(new SimpleGrantedAuthority("ROLE_PHOTOGRAPHER"))
            )
        );
        // TenantContext intentionally not set

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain, never()).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
    }

    @Test
    void authenticatedRequestWithBlankTenantIsRejected() throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                "user-id", null,
                List.of(new SimpleGrantedAuthority("ROLE_PHOTOGRAPHER"))
            )
        );
        TenantContext.setTenant("   ");

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain, never()).doFilter(request, response);
        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
    }
}
