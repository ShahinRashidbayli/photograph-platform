package com.photographplatform.api.invoice;

import com.photographplatform.api.invoice.service.InvoicePdfRenderer;
import java.io.IOException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the invoice PDF against silently losing text.
 *
 * <p>The renderer used to fall back to PDF's built-in base-14 fonts, whose
 * encoding cannot hold most of what a German invoice says. Text runs
 * containing an umlaut, an ß or a € were not degraded — they were dropped
 * whole. A real invoice rendered without the buyer's street ("Grünstraße 3"),
 * their city ("München"), the entire line-item description and all three
 * totals, while the API answered 200, the bytes were hashed into the GoBD
 * record, and the customer received the file.
 *
 * <p>These assertions read the glyphs back out of the produced PDF rather than
 * checking the HTML that went in. The HTML was always correct; the loss
 * happened during rendering, which is the only place it can be seen.
 */
class InvoicePdfRendererTest {

    private final InvoicePdfRenderer renderer = new InvoicePdfRenderer();

    private static final String GERMAN_HTML = """
        <html><body style="font-family: InvoiceSans, sans-serif;">
        <p>Grünstraße 3</p>
        <p>München</p>
        <p>Verlängerung Außenaufnahmen für Jörg Schröder</p>
        <p>Gesamtbetrag 2.142,00 €</p>
        </body></html>
        """;

    @Test
    void keepsUmlautsEszettAndTheEuroSign() throws IOException {
        String text = textOf(renderer.render(GERMAN_HTML).bytes());

        // Every one of these was silently missing from a real invoice.
        assertThat(text).contains("Grünstraße 3");
        assertThat(text).contains("München");
        assertThat(text).contains("Verlängerung Außenaufnahmen für Jörg Schröder");
        assertThat(text).contains("2.142,00");
        assertThat(text).as("the € sign is what emptied every totals row").contains("€");
    }

    /**
     * A base-14 font is not embedded, and that is precisely the state in which
     * the text was lost. Asserting on embedding rather than on the family name
     * keeps the test about the property that matters.
     */
    @Test
    void embedsItsFont() throws IOException {
        try (PDDocument doc = Loader.loadPDF(renderer.render(GERMAN_HTML).bytes())) {
            PDResources resources = doc.getPage(0).getResources();
            boolean anyFont = false;
            for (var name : resources.getFontNames()) {
                PDFont font = resources.getFont(name);
                anyFont = true;
                assertThat(font.isEmbedded())
                    .as("font %s must be embedded", font.getName())
                    .isTrue();
            }
            assertThat(anyFont).as("the page should draw text at all").isTrue();
        }
    }

    @Test
    void hashesTheBytesItReturns() {
        InvoicePdfRenderer.Rendered rendered = renderer.render(GERMAN_HTML);

        assertThat(rendered.sha256Hex()).hasSize(64).matches("[0-9a-f]{64}");
        // Deliberately not asserting that two renders hash alike: PDF carries a
        // creation timestamp, so they do not. The GoBD record hashes the bytes
        // that were actually archived, once, at issue time.
    }

    private static String textOf(byte[] pdf) throws IOException {
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(doc);
        }
    }
}
