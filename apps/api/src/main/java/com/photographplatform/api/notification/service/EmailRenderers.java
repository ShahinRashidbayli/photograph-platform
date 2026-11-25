package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.email.EmailRenderer;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * Every {@link EmailRenderer} bean, by template name.
 *
 * <p>Resolved on first use rather than injected as a list, because most
 * renderers also queue the email they render and so depend on
 * {@link EmailService}, which depends on this — a constructor-injected list
 * would be a cycle.
 */
@Component
public class EmailRenderers {

    private final ObjectProvider<EmailRenderer<?>> provider;
    private volatile Map<String, EmailRenderer<?>> byTemplate;

    public EmailRenderers(ObjectProvider<EmailRenderer<?>> provider) {
        this.provider = provider;
    }

    /** @throws IllegalArgumentException for a template no bean renders — a programming error */
    public EmailRenderer<?> get(String template) {
        EmailRenderer<?> renderer = all().get(template);
        if (renderer == null) {
            throw new IllegalArgumentException("No EmailRenderer for template " + template);
        }
        return renderer;
    }

    private Map<String, EmailRenderer<?>> all() {
        Map<String, EmailRenderer<?>> map = byTemplate;
        if (map == null) {
            map = provider.orderedStream()
                .collect(Collectors.toUnmodifiableMap(EmailRenderer::template, Function.identity()));
            byTemplate = map;
        }
        return map;
    }
}
