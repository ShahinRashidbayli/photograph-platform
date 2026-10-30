package com.photographplatform.api.invoice.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

/**
 * Renders invoice HTML (built by {@link InvoicePdfTemplate}, the same
 * hand-written-string convention {@code EmailTemplate} uses for emails) to
 * PDF bytes and hashes them for the GoBD-required {@code pdf_sha256} record.
 */
@Service
public class InvoicePdfRenderer {

    /**
     * The family name the stylesheet asks for. Must match
     * {@code InvoicePdfTemplate}'s font-family.
     */
    static final String FONT_FAMILY = "InvoiceSans";

    private static final String REGULAR = "fonts/DejaVuSans.ttf";
    private static final String BOLD = "fonts/DejaVuSans-Bold.ttf";

    public record Rendered(byte[] bytes, String sha256Hex) {
    }

    public Rendered render(String html) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfRendererBuilder builder = new PdfRendererBuilder();
        // useFastMode() used to be called here. In openhtmltopdf 1.1.73 the
        // method body is `return this;` — the fast renderer became the only
        // renderer and the switch was emptied out, so the call did nothing but
        // suggest a decision was being made. Removed rather than kept as
        // documentation of a setting that no longer exists.
        embedFonts(builder);
        builder.withHtmlContent(html, null);
        builder.toStream(out);
        try {
            builder.run();
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to render invoice PDF", ex);
        }
        byte[] bytes = out.toByteArray();
        return new Rendered(bytes, sha256Hex(bytes));
    }

    /**
     * Embeds a font that can actually draw the invoice.
     *
     * <p>Without this, openhtmltopdf falls back to PDF's built-in base-14
     * fonts, which are not embedded and whose encoding has no room for most of
     * what a German invoice contains. The failure is silent and total: every
     * text run holding a character outside that encoding is dropped whole, not
     * degraded. A real invoice came out missing the buyer's street
     * ("Grünstraße 3"), their city ("München"), the entire line-item
     * description, and all three totals — because each contained an umlaut, an
     * ß, or the € sign. The API still answered 200, the bytes were still
     * hashed into the GoBD record, and the customer still received the file.
     *
     * <p>The font is bundled as a classpath resource rather than resolved from
     * the host, so rendering does not depend on which fonts a machine or base
     * image happens to have — a difference that would otherwise change the
     * pdf_sha256 of the same invoice between environments.
     */
    private static void embedFonts(PdfRendererBuilder builder) {
        builder.useFont(() -> openFont(REGULAR), FONT_FAMILY, 400,
            PdfRendererBuilder.FontStyle.NORMAL, true);
        builder.useFont(() -> openFont(BOLD), FONT_FAMILY, 700,
            PdfRendererBuilder.FontStyle.NORMAL, true);
    }

    private static InputStream openFont(String path) {
        try {
            return new ClassPathResource(path).getInputStream();
        } catch (IOException e) {
            throw new IllegalStateException("Invoice font " + path + " is missing from the jar", e);
        }
    }

    private static String sha256Hex(byte[] bytes) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }
}
