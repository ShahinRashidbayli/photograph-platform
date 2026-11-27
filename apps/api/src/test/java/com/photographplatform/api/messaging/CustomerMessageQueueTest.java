package com.photographplatform.api.messaging;

import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.domain.Entitlements;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.messaging.application.CustomerMessageQueue;
import com.photographplatform.api.messaging.application.StudioIdentityResolver;
import com.photographplatform.api.messaging.domain.StudioIdentity;
import com.photographplatform.api.notification.dto.EmailType;
import com.photographplatform.api.notification.dto.OutgoingEmail;
import com.photographplatform.api.notification.service.EmailService;
import com.photographplatform.api.tenant.domain.Tenant;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The studio's identity is read once, at queueing, and travels with the message. */
class CustomerMessageQueueTest {

    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-0000000000aa");
    private static final UUID GALLERY = UUID.fromString("00000000-0000-0000-0000-0000000000bb");
    private static final Instant NOW = Instant.parse("2026-11-26T10:15:30Z");

    private record Params(StudioIdentity studio, String recipientName) {
    }

    private final PublicTenantResolver tenants = mock(PublicTenantResolver.class);
    private final EntitlementService entitlements = mock(EntitlementService.class);
    private final EmailService emailService = mock(EmailService.class);
    private Tenant tenant;
    private CustomerMessageQueue queue;

    @BeforeEach
    void setUp() {
        tenant = new Tenant("lichtblick", "anna@gmail.com");
        ReflectionTestUtils.setField(tenant, "id", TENANT);
        tenant.setBusinessName("Lichtblick Fotografie");
        tenant.setLegalEmail("kontakt@lichtblick.de");
        tenant.setLogoKey("logos/" + TENANT + "/00000000-0000-0000-0000-000000000001.png");
        tenant.setBrandColor("#AA3366");
        when(tenants.requireById(TENANT)).thenReturn(tenant);
        when(emailService.queue(any())).thenReturn(true);
        StudioIdentityResolver identities =
            new StudioIdentityResolver(tenants, entitlements, "https://app.fotolio.de");
        queue = new CustomerMessageQueue(identities, emailService, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private void plan(Capability... capabilities) {
        when(entitlements.forTenant(tenant)).thenReturn(new Entitlements(
            tenant.plan(), Set.of(capabilities), 30, 1, 0, 0L));
    }

    private OutgoingEmail queued() {
        queue.queue(new CustomerMessageQueue.Message(
            "messaging.gallery-ready", EmailType.GALLERY_READY, GALLERY, TENANT, "maria@example.test",
            studio -> new Params(studio, "Maria"), null));
        ArgumentCaptor<OutgoingEmail> sent = ArgumentCaptor.forClass(OutgoingEmail.class);
        verify(emailService).queue(sent.capture());
        return sent.getValue();
    }

    @Test
    void sendsUnderTheStudioNameWithItsReplyAddress() {
        plan();

        OutgoingEmail email = queued();

        assertThat(email.fromName()).isEqualTo("Lichtblick Fotografie");
        assertThat(email.replyTo()).isEqualTo("kontakt@lichtblick.de");
        assertThat(email.tenantId()).isEqualTo(TENANT);
        assertThat(email.to()).isEqualTo("maria@example.test");
    }

    @Test
    void keysEachSendByTypeAggregateAndTime() {
        plan();

        assertThat(queued().idempotencyKey())
            .isEqualTo("GALLERY_READY:" + GALLERY + ":2026-11-26T10:15:30Z");
    }

    @Test
    void freezesTheIdentityIntoTheParams() {
        plan();

        Params params = (Params) queued().params();

        assertThat(params.studio().displayName()).isEqualTo("Lichtblick Fotografie");
        assertThat(params.studio().whiteLabel()).isFalse();
        assertThat(params.studio().logoUrl()).isNull();
        assertThat(params.recipientName()).isEqualTo("Maria");
    }

    @Test
    void pointsAWhiteLabelLogoAtTheStablePublicRoute() {
        plan(Capability.WHITE_LABEL_BRANDING);

        StudioIdentity studio = ((Params) queued().params()).studio();

        assertThat(studio.whiteLabel()).isTrue();
        assertThat(studio.logoUrl()).isEqualTo("https://app.fotolio.de/api/public/studios/lichtblick/logo");
        assertThat(studio.brandColor()).isEqualTo("#AA3366");
    }

    @Test
    void hasNoLogoUrlWhenTheStudioUploadedNone() {
        tenant.setLogoKey(null);
        plan(Capability.WHITE_LABEL_BRANDING);

        assertThat(((Params) queued().params()).studio().logoUrl()).isNull();
    }

    @Test
    void hasNoLogoUrlForAKeyThePublicRouteWouldNotServe() {
        // An absolute URL stored by hand: the route answers 404, so the email
        // would show a broken image.
        tenant.setLogoKey("https://elsewhere.test/logo.png");
        plan(Capability.WHITE_LABEL_BRANDING);

        assertThat(((Params) queued().params()).studio().logoUrl()).isNull();
    }
}
