package com.photographplatform.api.notification.service;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/** The studio's alert about a signed-in Customer's request, in the recipient's language (#126). */
class InquiryNotificationServiceTest {

    private static RenderedEmail render(CustomerLanguage language) {
        InquiryNotificationService renderer = new InquiryNotificationService(null);
        ReflectionTestUtils.setField(renderer, "webBaseUrl", "https://app.fotolio.de");
        return renderer.render(new InquiryNotificationService.Params(UUID.randomUUID(), "MED", "Maria",
            "maria@example.test", "HOCHZEIT", "OVER_2000", LocalDate.of(2027, 6, 12), "Berlin", language));
    }

    @Test
    void german() {
        RenderedEmail email = render(CustomerLanguage.DE);

        assertThat(email.subject()).isEqualTo("🟡 Neue Anfrage — Maria");
        assertThat(email.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Neue Shooting-Anfrage")
            .contains("Mittlere Priorität")
            .contains("Wunschtermin")
            .contains("12. Juni 2027")
            .contains("Hochzeit")
            .contains("Von Fotolio gesendet")
            .doesNotContain("Preferred date").doesNotContain("Wedding");
    }

    @Test
    void english() {
        RenderedEmail email = render(CustomerLanguage.EN);

        assertThat(email.subject()).isEqualTo("🟡 New request — Maria");
        assertThat(email.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("New session request")
            .contains("Medium priority")
            .contains("Preferred date")
            .contains("12 Jun 2027")
            .contains("Wedding")
            .contains("Sent by Fotolio")
            .doesNotContain("Wunschtermin").doesNotContain("Hochzeit");
    }
}
