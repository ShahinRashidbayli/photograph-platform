package com.photographplatform.api.notification.service;

import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.notification.email.RenderedEmail;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class ContractNotificationServiceTest {

    private static final UUID BOOKING = UUID.fromString("00000000-0000-0000-0000-0000000000b1");

    @Test
    void openTheBookingLinksToTheBookingDetailThatExists() {
        ContractNotificationService service = new ContractNotificationService(null);
        ReflectionTestUtils.setField(service, "webBaseUrl", "https://app.fotolio.de/");

        RenderedEmail email = service.render(
            new ContractNotificationService.Params(UUID.randomUUID(), BOOKING, "Vertrag", "Maria", null));

        assertThat(email.htmlBody())
            .contains("https://app.fotolio.de/bookings?id=" + BOOKING)
            .doesNotContain("/bookings/" + BOOKING);
    }

    private static RenderedEmail render(CustomerLanguage language) {
        ContractNotificationService service = new ContractNotificationService(null);
        ReflectionTestUtils.setField(service, "webBaseUrl", "https://app.fotolio.de");
        return service.render(
            new ContractNotificationService.Params(UUID.randomUUID(), BOOKING, "Hochzeit Weber", "Maria", language));
    }

    @Test
    void german() {
        RenderedEmail email = render(CustomerLanguage.DE);

        assertThat(email.subject()).isEqualTo("✍️ Vertrag unterschrieben — Hochzeit Weber");
        assertThat(email.htmlBody())
            .contains("<html lang=\"de\"")
            .contains("Ihr Vertrag wurde unterschrieben")
            .contains("Unterschrieben von")
            .contains("Buchung öffnen")
            .doesNotContain("Signed by");
    }

    @Test
    void english() {
        RenderedEmail email = render(CustomerLanguage.EN);

        assertThat(email.subject()).isEqualTo("✍️ Contract signed — Hochzeit Weber");
        assertThat(email.htmlBody())
            .contains("<html lang=\"en\"")
            .contains("Your contract was signed")
            .contains("Signed by")
            .contains("Open the booking")
            .doesNotContain("Unterschrieben von");
    }
}
