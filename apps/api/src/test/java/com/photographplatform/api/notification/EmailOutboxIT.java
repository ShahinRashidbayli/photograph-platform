package com.photographplatform.api.notification;

import com.photographplatform.api.IntegrationTestBase;
import com.photographplatform.api.auth.service.SignInCodeEmail;
import com.photographplatform.api.common.domain.CustomerLanguage;
import com.photographplatform.api.notification.dto.EmailMessage;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.service.EmailSender;
import com.photographplatform.api.notification.service.EmailService;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.HttpServerErrorException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Email through the outbox, end to end: queued by {@link EmailService},
 * claimed by the worker, rendered at send time and handed to the transport
 * (ADR-005). The poller is off under test, so each step is a drain the test
 * makes itself.
 */
class EmailOutboxIT extends IntegrationTestBase {

    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-00000000e0e0");

    @Autowired private EmailService emailService;
    @Autowired private PlatformTransactionManager txManager;

    @MockitoBean private EmailSender sender;

    @BeforeEach
    void setUp() {
        reset(sender);
        when(sender.providerName()).thenReturn("test");
    }

    private static OutgoingEmail signInCode(String to, OffsetDateTime expiresAt) {
        return new OutgoingEmail(SignInCodeEmail.TEMPLATE, to, TENANT,
            new SignInCodeEmail.Params("Maria", "123456", 10, CustomerLanguage.EN), null, expiresAt);
    }

    private void queueCommitted(OutgoingEmail email) {
        new TransactionTemplate(txManager).executeWithoutResult(status -> emailService.queue(email));
    }

    @Test
    void aQueuedEmailIsRenderedAndDeliveredThenForgotten() {
        queueCommitted(signInCode("maria@example.test", OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(10)));

        deliverQueuedEmail();

        ArgumentCaptor<EmailMessage> sent = ArgumentCaptor.forClass(EmailMessage.class);
        verify(sender).send(sent.capture());
        EmailMessage mail = sent.getValue();
        assertThat(mail.to()).isEqualTo("maria@example.test");
        assertThat(mail.subject()).isEqualTo("Your sign-in code: 123456");
        assertThat(mail.htmlBody()).contains("Hi Maria");
        assertThat(mail.type()).isEqualTo(EmailType.LOGIN_CODE);
        assertThat(mail.tenantId()).isEqualTo(TENANT);
        assertThat(countAcrossTenants("SELECT count(*) FROM outbox_jobs")).isZero();
    }

    @Test
    void theQueueHoldsInputsNeverARenderedEmail() {
        doThrow(new HttpServerErrorException(HttpStatus.SERVICE_UNAVAILABLE)).when(sender).send(any());
        queueCommitted(signInCode("maria@example.test", null));
        deliverQueuedEmail();

        String payload = valueAcrossTenants("SELECT payload::text FROM outbox_jobs");
        assertThat(payload).contains("auth.sign-in-code").doesNotContain("<");
        assertThat(payload).doesNotContain("Your sign-in code");
    }

    @Test
    void aProviderOutageIsRetriedAndDeliveredOnceItRecovers() {
        doThrow(new HttpServerErrorException(HttpStatus.SERVICE_UNAVAILABLE))
            .doNothing()
            .when(sender).send(any());
        queueCommitted(signInCode("maria@example.test", null));

        deliverQueuedEmail();
        verify(sender).send(any());
        assertThat(valueAcrossTenants("SELECT last_error FROM outbox_jobs"))
            .as("the status says whose problem it is; the message would carry the recipient")
            .endsWith("status=503");
        assertThat(countAcrossTenants("SELECT count(*) FROM outbox_jobs WHERE status = 'PENDING' "
            + "AND next_run_at > now() + interval '30 seconds'")).isEqualTo(1);

        deliverQueuedEmail();
        verify(sender).send(any());

        // Time passes: the retry is due.
        executeAcrossTenants("UPDATE outbox_jobs SET next_run_at = now()");
        deliverQueuedEmail();
        deliverQueuedEmail();

        verify(sender, times(2)).send(any());
        assertThat(countAcrossTenants("SELECT count(*) FROM outbox_jobs")).isZero();
    }

    @Test
    void aRolledBackWriteSendsNothing() {
        new TransactionTemplate(txManager).executeWithoutResult(status -> {
            emailService.queue(signInCode("maria@example.test", null));
            status.setRollbackOnly();
        });

        deliverQueuedEmail();
        verify(sender, never()).send(any());
        assertThat(countAcrossTenants("SELECT count(*) FROM outbox_jobs")).isZero();
    }

    @Test
    void aSignInCodeThatExpiredWhileQueuedIsNotSentLate() {
        queueCommitted(signInCode("maria@example.test", OffsetDateTime.now(ZoneOffset.UTC).minusSeconds(1)));

        deliverQueuedEmail();

        verify(sender, never()).send(any());
        assertThat(countAcrossTenants("SELECT count(*) FROM outbox_jobs")).isZero();
    }

    @Test
    void theSameEmailQueuedTwiceIsDeliveredOnce() {
        doNothing().when(sender).send(any());
        OutgoingEmail alert = new OutgoingEmail(SignInCodeEmail.TEMPLATE, "owner@studio.test", TENANT,
            new SignInCodeEmail.Params("Owner", "654321", 10, CustomerLanguage.DE), "LEAD_NOTIFICATION:42", null);
        new TransactionTemplate(txManager).executeWithoutResult(status -> {
            emailService.queue(alert);
            emailService.queue(alert);
        });

        deliverQueuedEmail();
        deliverQueuedEmail();

        verify(sender, times(1)).send(any());
    }
}
