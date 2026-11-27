package com.photographplatform.api.messaging;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.messaging.domain.CustomerMessageLayout;
import com.photographplatform.api.messaging.domain.PersonalNote;
import com.photographplatform.api.messaging.domain.StudioIdentity;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CustomerMessageLayoutTest {

    private static final StudioIdentity STARTER = new StudioIdentity(
        "Lichtblick Fotografie", "kontakt@lichtblick.de", false, null, null);
    private static final StudioIdentity WHITE_LABEL = new StudioIdentity(
        "Lichtblick Fotografie", "kontakt@lichtblick.de", true,
        "https://app.fotolio.de/api/public/studios/lichtblick/logo", "#AA3366");

    private static String render(StudioIdentity studio, CustomerLanguage language, String body) {
        return CustomerMessageLayout.document(studio, language, "Vorschau", body);
    }

    @Test
    void marksAGermanMessageAsGerman() {
        String html = render(STARTER, CustomerLanguage.DE, "");

        assertThat(html).contains("<html lang=\"de\"").doesNotContain("lang=\"en\"");
    }

    @Test
    void marksAnEnglishMessageAsEnglish() {
        String html = render(STARTER, CustomerLanguage.EN, "");

        assertThat(html).contains("<html lang=\"en\"").doesNotContain("lang=\"de\"");
    }

    @Test
    void putsTheStudioNameAtTheTop() {
        String html = render(STARTER, CustomerLanguage.DE, "<p>Inhalt</p>");

        assertThat(html.indexOf("Lichtblick Fotografie</span>")).isPositive().isLessThan(html.indexOf("Inhalt"));
    }

    @Test
    void saysWhoDeliversItOnOtherPlans() {
        assertThat(render(STARTER, CustomerLanguage.DE, "")).contains("Versendet über Fotolio");
        assertThat(render(STARTER, CustomerLanguage.EN, "")).contains("Sent via Fotolio");
    }

    @Test
    void wearsTheStudiosLookAndNeverMentionsFotolioOnWhiteLabel() {
        String html = render(WHITE_LABEL, CustomerLanguage.DE,
            CustomerMessageLayout.button(WHITE_LABEL, "Galerie ansehen", "https://example.test/g"));

        assertThat(html)
            .contains("<img src=\"https://app.fotolio.de/api/public/studios/lichtblick/logo\"")
            .contains("alt=\"Lichtblick Fotografie\"")
            .contains("background:#AA3366")
            .doesNotContainIgnoringCase("Fotolio<")
            .doesNotContain("Versendet über", "Sent via", "#6366F1");
        // The logo URL is on the platform's domain; the visible text must not be.
        assertThat(html.replace("app.fotolio.de", "")).doesNotContainIgnoringCase("fotolio");
    }

    @Test
    void keepsTheShellNeutralWithoutABrandColour() {
        String html = render(STARTER, CustomerLanguage.DE,
            CustomerMessageLayout.button(STARTER, "Ansehen", "https://example.test"));

        assertThat(html).doesNotContain("#6366F1", "#4F46E5", "<img");
    }

    @Test
    void rendersANoteWithAScriptTagAsText() {
        String body = CustomerMessageLayout.personalNote(STARTER, new PersonalNote("<script>alert(1)</script>"));
        String html = render(STARTER, CustomerLanguage.DE, body);

        assertThat(html).doesNotContain("<script>").contains("&lt;script&gt;alert(1)&lt;/script&gt;");
    }

    @Test
    void rendersNothingForNoNote() {
        assertThat(CustomerMessageLayout.personalNote(STARTER, null)).isEmpty();
    }

    @Test
    void escapesTheStudioName() {
        StudioIdentity studio = new StudioIdentity("Foto <b>&</b> Co", null, false, null, null);

        assertThat(render(studio, CustomerLanguage.DE, "")).contains("Foto &lt;b&gt;&amp;&lt;/b&gt; Co")
            .doesNotContain("<b>");
    }
}
