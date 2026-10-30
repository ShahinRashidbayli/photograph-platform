package com.photographplatform.api.common;

import jakarta.servlet.http.Cookie;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * MockMvc helper mirroring the double-submit contract enforced by
 * {@code StatelessCsrfFilter}: a matching {@code XSRF-TOKEN} cookie and
 * {@code X-XSRF-TOKEN} header. Use in place of Spring Security's {@code csrf()}
 * postprocessor, which drives Spring's own {@code CsrfFilter} — no longer in
 * the chain now that CSRF is a plain stateless double-submit check.
 */
public final class CsrfTestSupport {

    private static final String TOKEN = "test-csrf-token";

    private CsrfTestSupport() {
    }

    /** Adds a matching XSRF-TOKEN cookie and X-XSRF-TOKEN header to the request. */
    public static RequestPostProcessor xsrf() {
        return request -> {
            request.setCookies(new Cookie("XSRF-TOKEN", TOKEN));
            request.addHeader("X-XSRF-TOKEN", TOKEN);
            return request;
        };
    }
}
