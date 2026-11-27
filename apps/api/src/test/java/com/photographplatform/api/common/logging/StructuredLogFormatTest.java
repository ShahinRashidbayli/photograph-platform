package com.photographplatform.api.common.logging;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.LoggingEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.slf4j.event.KeyValuePair;
import org.springframework.boot.logging.logback.StructuredLogEncoder;
import org.springframework.core.env.Environment;
import org.springframework.core.env.StandardEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What the deployed image writes ({@code LOGGING_STRUCTURED_FORMAT_CONSOLE=logstash}
 * in the Dockerfile), checked against what Railway's log explorer reads: a
 * top-level {@code level} and {@code message}, and every other top-level key as
 * an attribute to filter on. A nested field ({@code log.level}, as the ECS
 * format writes it) is not documented to be recognised — which is why this
 * format and not that one.
 */
class StructuredLogFormatTest {

    @Test
    void levelMessageAndEveryLogFieldSitAtTheTopLevel() throws Exception {
        LoggerContext context = new LoggerContext();
        context.putObject(Environment.class.getName(), new StandardEnvironment());
        StructuredLogEncoder encoder = new StructuredLogEncoder();
        encoder.setContext(context);
        encoder.setFormat("logstash");
        encoder.start();

        Logger logger = context.getLogger(StructuredLogFormatTest.class);
        LoggingEvent event = new LoggingEvent(
            Logger.class.getName(), logger, Level.INFO, "Outbox job {} queued", null, new Object[] {"j-1"});
        event.setMDCPropertyMap(Map.of(LogFields.REQUEST_ID, "r-1", LogFields.TENANT_ID, "t-1"));
        event.setKeyValuePairs(List.of(
            new KeyValuePair(LogFields.OUTBOX_KIND, "LEAD_NOTIFICATION"),
            new KeyValuePair(LogFields.DURATION_MS, 12L)));

        JsonNode line = new ObjectMapper().readTree(new String(encoder.encode(event), StandardCharsets.UTF_8));

        assertThat(line.path("level").asText()).isEqualTo("INFO");
        assertThat(line.path("message").asText()).isEqualTo("Outbox job j-1 queued");
        assertThat(line.path(LogFields.REQUEST_ID).asText()).isEqualTo("r-1");
        assertThat(line.path(LogFields.TENANT_ID).asText()).isEqualTo("t-1");
        assertThat(line.path(LogFields.OUTBOX_KIND).asText()).isEqualTo("LEAD_NOTIFICATION");
        // A number stays a number, so `@duration_ms:>=1000` compares rather than matches text.
        assertThat(line.path(LogFields.DURATION_MS).isNumber()).isTrue();
    }
}
