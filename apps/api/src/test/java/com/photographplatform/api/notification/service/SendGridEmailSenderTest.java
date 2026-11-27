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
 * A Customer message goes out under the studio's name, from Fotolio's own
 * address, and a reply reaches the studio. Everything else keeps the global
 * sender name and has no Reply-To.
 */
class SendGridEmailSenderTest {

    private static final EmailProperties PROPS = new EmailProperties(
        "sendgrid", "noreply@fotolio.de", "Fotolio",
        new EmailProperties.Provider("sg-key", "https://sendgrid.test"), null);

    private final RestClient.Builder builder = RestClient.builder();
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final SendGridEmailSender sender = new SendGridEmailSender(builder.build(), PROPS);

    @Test
    void sendsUnderTheMessagesOwnNameWithItsReplyTo() {
        server.expect(requestTo("https://sendgrid.test/v3/mail/send"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(jsonPath("$.from.email").value("noreply@fotolio.de"))
            .andExpect(jsonPath("$.from.name").value("Atelier Müller"))
            .andExpect(jsonPath("$.reply_to.email").value("hallo@atelier-mueller.test"))
            .andRespond(withStatus(HttpStatus.ACCEPTED));

        sender.send(new EmailMessage("kunde@example.test", "Ihr Vertrag", "<p>Hallo</p>",
            EmailType.CONTRACT_SIGNED, UUID.randomUUID(), "Atelier Müller", "hallo@atelier-mueller.test"));

        server.verify();
    }

    @Test
    void withoutItsOwnNameSendsAsFotolioWithNoReplyTo() {
        server.expect(requestTo("https://sendgrid.test/v3/mail/send"))
            .andExpect(jsonPath("$.from.email").value("noreply@fotolio.de"))
            .andExpect(jsonPath("$.from.name").value("Fotolio"))
            .andExpect(jsonPath("$.reply_to").doesNotExist())
            .andRespond(withStatus(HttpStatus.ACCEPTED));

        sender.send(new EmailMessage("kunde@example.test", "Ihr Code", "<p>123456</p>",
            EmailType.LOGIN_CODE, UUID.randomUUID()));

        server.verify();
    }
}
