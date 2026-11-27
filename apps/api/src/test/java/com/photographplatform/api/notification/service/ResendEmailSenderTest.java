package com.photographplatform.api.notification.service;

import com.photographplatform.api.notification.config.EmailProperties;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

/**
 * Resend takes the sender as one RFC 5322 string, so a studio name with a
 * comma must arrive quoted or it reads as two addresses.
 */
class ResendEmailSenderTest {

    private static final EmailProperties PROPS = new EmailProperties(
        "resend", "noreply@fotolio.de", "Fotolio",
        null, new EmailProperties.Provider("re-key", "https://resend.test"));

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final ResendEmailSender sender = new ResendEmailSender(builder.build(), PROPS);

    @Test
    void sendsUnderTheMessagesOwnNameWithItsReplyTo() {
        server.expect(requestTo("https://resend.test/emails"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(jsonPath("$.from").value("\"Müller, Fotografie\" <noreply@fotolio.de>"))
            .andExpect(jsonPath("$.reply_to").value("hallo@mueller.test"))
            .andRespond(withStatus(HttpStatus.OK));

        sender.send(new EmailMessage("kunde@example.test", "Ihre Galerie", "<p>Hallo</p>",
            EmailType.INQUIRY_REPLY, UUID.randomUUID(), "Müller, Fotografie", "hallo@mueller.test"));

        server.verify();
    }

    @Test
    void withoutItsOwnNameSendsAsFotolioWithNoReplyTo() {
        server.expect(requestTo("https://resend.test/emails"))
            .andExpect(jsonPath("$.from").value("Fotolio <noreply@fotolio.de>"))
            .andExpect(jsonPath("$.reply_to").doesNotExist())
            .andRespond(withStatus(HttpStatus.OK));

        sender.send(new EmailMessage("kunde@example.test", "Ihr Code", "<p>123456</p>",
            EmailType.LOGIN_CODE, UUID.randomUUID()));

        server.verify();
    }
}
