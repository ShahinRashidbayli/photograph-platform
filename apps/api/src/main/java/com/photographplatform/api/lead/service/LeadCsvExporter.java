package com.photographplatform.api.lead.service;

import com.photographplatform.api.lead.domain.Lead;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

/**
 * CSV rendering for the leads export, extracted from {@link LeadService} so the
 * service no longer owns row layout and RFC 4180 escaping alongside its CRUD
 * and conversion logic. Pure formatting: the caller supplies the already-loaded
 * leads and the target stream, and owns the transaction.
 *
 * <p>Writes directly to the stream so the payload size is bounded by network
 * throughput rather than by buffering the whole document in memory. Header row
 * first, then one row per lead.
 *
 * <p>CSV escaping per RFC 4180: any field containing a quote, comma, or newline
 * is wrapped in double-quotes and inner quotes are doubled.
 */
@Component
public class LeadCsvExporter {

    private static final String HEADER =
        "id,name,email,phone,event_date,event_type,budget_range,score,status,created_at\n";

    /**
     * Writes the export as the leads arrive. Takes a {@link Stream} rather
     * than a {@code List} so the caller can hand over a cursor-backed result
     * set and neither side ever holds the whole export in memory.
     */
    public void write(OutputStream out, Stream<Lead> leads) throws IOException {
        OutputStreamWriter w = new OutputStreamWriter(out, StandardCharsets.UTF_8);
        w.write(HEADER);
        for (Lead lead : (Iterable<Lead>) leads::iterator) {
            w.write(csvEscape(lead.getId() == null ? "" : lead.getId().toString()));
            w.write(',');
            w.write(csvEscape(lead.getName()));
            w.write(',');
            w.write(csvEscape(lead.getEmail()));
            w.write(',');
            w.write(csvEscape(lead.getPhone()));
            w.write(',');
            w.write(csvEscape(lead.getEventDate() == null ? "" : lead.getEventDate().toString()));
            w.write(',');
            w.write(csvEscape(lead.getEventType()));
            w.write(',');
            w.write(csvEscape(lead.getBudgetRange()));
            w.write(',');
            w.write(csvEscape(lead.getScore()));
            w.write(',');
            w.write(csvEscape(lead.getStatus().name()));
            w.write(',');
            w.write(csvEscape(lead.getCreatedAt() == null ? "" : lead.getCreatedAt().toString()));
            w.write('\n');
        }
        w.flush();
    }

    private static String csvEscape(String value) {
        if (value == null) {
            return "";
        }
        boolean needsQuote = value.indexOf(',') >= 0
            || value.indexOf('"') >= 0
            || value.indexOf('\n') >= 0
            || value.indexOf('\r') >= 0;
        if (!needsQuote) {
            return value;
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
