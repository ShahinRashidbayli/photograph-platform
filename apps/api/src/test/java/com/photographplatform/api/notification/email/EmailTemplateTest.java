package com.photographplatform.api.notification.email;

import com.photographplatform.api.common.domain.CustomerLanguage;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** The Fotolio shell's language and the greeting every Notification and sign-in email opens with (#126). */
class EmailTemplateTest {

    @Test
    void theShellSpeaksTheReadersLanguage() {
        assertThat(EmailTemplate.document("p", "<p>x</p>", CustomerLanguage.DE))
            .contains("<html lang=\"de\"")
            .contains("lang=\"de\" class=\"fl-page\"")
            .contains("Von Fotolio gesendet")
            .doesNotContain("Sent by Fotolio");
        assertThat(EmailTemplate.document("p", "<p>x</p>", CustomerLanguage.EN))
            .contains("<html lang=\"en\"")
            .contains("Sent by Fotolio")
            .doesNotContain("Von Fotolio gesendet");
    }

    @Test
    void noLanguageIsGerman() {
        assertThat(EmailTemplate.document("p", "<p>x</p>", null)).contains("<html lang=\"de\"");
    }

    @Test
    void aPreheaderIsNeverReadAsAPlaceholder() {
        String html = EmailTemplate.document("{{BODY}}", "<p>the body</p>", CustomerLanguage.EN);

        assertThat(html).containsOnlyOnce("<p>the body</p>").contains("{{BODY}}");
    }

    @Test
    void greetsByName() {
        assertThat(EmailTemplate.greeting(CustomerLanguage.DE, " Anna Weber ")).contains(">Hallo Anna Weber,</p>");
        assertThat(EmailTemplate.greeting(CustomerLanguage.EN, "Anna")).contains(">Hi Anna,</p>");
    }

    @Test
    void withoutANameTheGreetingIsNeutral() {
        assertThat(EmailTemplate.greeting(CustomerLanguage.DE, null)).contains(">Hallo,</p>");
        assertThat(EmailTemplate.greeting(CustomerLanguage.EN, "  ")).contains(">Hi,</p>");
    }

    @Test
    void neverGreetsAnEmailAddress() {
        assertThat(EmailTemplate.greeting(CustomerLanguage.DE, "kunde.anna@example.test"))
            .contains(">Hallo,</p>")
            .doesNotContain("kunde.anna");
    }

    @Test
    void theNameIsEscaped() {
        assertThat(EmailTemplate.greeting(CustomerLanguage.EN, "<b>Anna</b>"))
            .contains("Hi &lt;b&gt;Anna&lt;/b&gt;,")
            .doesNotContain("<b>");
    }
}
