package com.photographplatform.api.messaging;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.messaging.application.EnquiryReceivedMessage;
import com.photographplatform.api.messaging.application.EnquiryReceivedMessage.Params;
import com.photographplatform.api.messaging.domain.StudioIdentity;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Enquiry received, rendered: the studio's name, the Customer's language, and
 * not one claim the studio did not make (#103).
 */
class EnquiryReceivedMessageTest {

    private static final String PORTFOLIO = "https://app.fotolio.de/p/lichtblick";

    /**
     * What the message it replaces promised, in both languages. None of it is
     * anything the studio entered, so none of it may come back.
     */
    private static final List<String> INVENTED_CLAIMS = List.of(
        "Paket", "Package", "Preis", "Price", "€", "EUR", "Erfahrung", "experience", "Hochzeiten",
        "weddings", "innerhalb", "within", "24 Stunden", "24 hours", "melden uns", "get back to you");

    private final EnquiryReceivedMessage message =
        new EnquiryReceivedMessage(null, null, null, "https://app.fotolio.de");

    private static StudioIdentity studio() {
        return StudioIdentity.resolve("Studio Lichtblick", "hallo@lichtblick.test",
            "anna@gmail.com", false, null, null);
    }

    @Test
    void germanIsAddressedWithSieInTheStudiosName() {
        RenderedEmail email = message.render(new Params(studio(), CustomerLanguage.DE, "Maria", PORTFOLIO));

        assertThat(email.subject()).isEqualTo("Ihre Anfrage bei Studio Lichtblick");
        assertThat(email.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Guten Tag Maria,")
            .contains("vielen Dank für Ihre Anfrage. Sie ist bei <strong>Studio Lichtblick</strong> eingegangen.")
            .contains("antworten Sie einfach auf diese E-Mail")
            .contains("Freundliche Grüße<br><strong>Studio Lichtblick</strong>")
            .contains("Versendet über Fotolio")
            .doesNotContain(" du ").doesNotContain(" dir ").doesNotContain(" dein");
    }

    @Test
    void englishIsInEnglishThroughout() {
        RenderedEmail email = message.render(new Params(studio(), CustomerLanguage.EN, "Maria", PORTFOLIO));

        assertThat(email.subject()).isEqualTo("Your enquiry to Studio Lichtblick");
        assertThat(email.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Hello Maria,")
            .contains("Thank you for your enquiry. It has reached <strong>Studio Lichtblick</strong>.")
            .contains("simply reply to this email")
            .contains("Kind regards<br><strong>Studio Lichtblick</strong>")
            .contains("Sent via Fotolio")
            .doesNotContain("Anfrage").doesNotContain("Grüße");
    }

    @ParameterizedTest
    @EnumSource(CustomerLanguage.class)
    void itPromisesNothingTheStudioDidNotSay(CustomerLanguage language) {
        RenderedEmail email = message.render(new Params(studio(), language, "Maria", PORTFOLIO));

        for (String claim : INVENTED_CLAIMS) {
            assertThat(email.subject() + email.htmlBody()).as(claim).doesNotContainIgnoringCase(claim);
        }
    }

    @ParameterizedTest
    @EnumSource(CustomerLanguage.class)
    void thePortfolioLinkAppearsOnlyWhenThereIsOneToShow(CustomerLanguage language) {
        RenderedEmail with = message.render(new Params(studio(), language, "Maria", PORTFOLIO));
        RenderedEmail without = message.render(new Params(studio(), language, "Maria", null));

        assertThat(with.htmlBody()).contains("href=\"" + PORTFOLIO + "\"");
        assertThat(without.htmlBody()).doesNotContain("/p/").doesNotContain("<a ")
            .doesNotContain("Portfolio");
    }

    @Test
    void aStudioWithNoNameYetGetsNoneInvented() {
        RenderedEmail email = message.render(new Params(
            StudioIdentity.resolve(null, null, "anna@gmail.com", false, null, null),
            CustomerLanguage.DE, " ", null));

        assertThat(email.subject()).isEqualTo("Ihre Anfrage ist eingegangen");
        assertThat(email.htmlBody())
            .contains("Guten Tag,")
            .contains("vielen Dank für Ihre Anfrage. Sie ist eingegangen.")
            .doesNotContain("<strong>")
            .doesNotContain("null");
    }

    @Test
    void whatTheCustomerTypedIsEscaped() {
        RenderedEmail email = message.render(new Params(
            StudioIdentity.resolve("A & B <i>", null, null, false, null, null),
            CustomerLanguage.EN, "<b>Maria</b>", null));

        assertThat(email.htmlBody())
            .contains("Hello &lt;b&gt;Maria&lt;/b&gt;,")
            .contains("<strong>A &amp; B &lt;i&gt;</strong>")
            .doesNotContain("<b>Maria</b>");
    }

    @Test
    void whiteLabelHidesFotolio() {
        RenderedEmail email = message.render(new Params(
            StudioIdentity.resolve("Studio Lichtblick", null, null, true, null, "#AA3366"),
            CustomerLanguage.DE, "Maria", PORTFOLIO));

        assertThat(email.htmlBody()).doesNotContain("Fotolio").contains("#AA3366");
    }
}
