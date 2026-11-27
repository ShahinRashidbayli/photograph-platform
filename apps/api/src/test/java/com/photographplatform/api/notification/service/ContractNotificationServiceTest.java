package com.photographplatform.api.notification.service;

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
            new ContractNotificationService.Params(UUID.randomUUID(), BOOKING, "Vertrag", "Maria"));

        assertThat(email.htmlBody())
            .contains("https://app.fotolio.de/bookings?id=" + BOOKING)
            .doesNotContain("/bookings/" + BOOKING);
    }
}
