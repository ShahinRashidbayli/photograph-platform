package com.photographplatform.api.invoice.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import org.springframework.stereotype.Service;

/**
 * Renders invoice HTML (built by {@link InvoicePdfTemplate}, the same
 * hand-written-string convention {@code EmailTemplate} uses for emails) to
 * PDF bytes and hashes them for the GoBD-required {@code pdf_sha256} record.
 */
@Service
public class InvoicePdfRenderer {

    public record Rendered(byte[] bytes, String sha256Hex) {
    }

    public Rendered render(String html) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfRendererBuilder builder = new PdfRendererBuilder();
        builder.useFastMode();
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
