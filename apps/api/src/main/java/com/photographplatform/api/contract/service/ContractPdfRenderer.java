package com.photographplatform.api.contract.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

/**
 * Renders contract HTML to PDF bytes.
 *
 * <p>Deliberately a second renderer rather than a call into
 * {@code InvoicePdfRenderer}. That one is invoice infrastructure — it hashes
 * its output for the GoBD {@code pdf_sha256} record, which a contract does not
 * want (a contract's evidence is the hash of its *text*, taken at signature;
 * see {@code Contract#sign}). Reaching into another feature's service to reuse
 * twenty lines of font wiring would couple two modules through the wrong seam,
 * and DEVELOPMENT_PLAN's rule 4 asks a new feature to be a new package rather
 * than an edit to an existing one. The duplication is the font block below and
 * is knowingly accepted; if a third renderer appears, that is the moment to
 * lift a shared one into {@code common}.
 */
@Service
public class ContractPdfRenderer {

    /** Must match the font-family {@link ContractPdfTemplate} asks for. */
    static final String FONT_FAMILY = "ContractSans";

    private static final String REGULAR = "fonts/DejaVuSans.ttf";
    private static final String BOLD = "fonts/DejaVuSans-Bold.ttf";

    public byte[] render(String html) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        PdfRendererBuilder builder = new PdfRendererBuilder();
        embedFonts(builder);
        builder.withHtmlContent(html, null);
        builder.toStream(out);
        try {
            builder.run();
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to render contract PDF", ex);
        }
        return out.toByteArray();
    }

    /**
     * Embeds a font that can actually draw a German contract.
     *
     * <p>Without this openhtmltopdf falls back to PDF's base-14 fonts, whose
     * encoding has no room for umlauts, ß or €. The failure is silent and
     * total — an affected text run is dropped whole rather than degraded — and
     * the invoice module has already been bitten by exactly this (see
     * {@code InvoicePdfRenderer#embedFonts} for the post-mortem). A contract
     * losing "Vergütung" or a party's name would be worse.
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
            throw new IllegalStateException("Contract font " + path + " is missing from the jar", e);
        }
    }
}
