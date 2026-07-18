package com.photographplatform.api.gallery;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.dto.CreateGalleryRequest;
import com.photographplatform.api.gallery.dto.UpdateGalleryRequest;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository.GalleryStatsView;
import com.photographplatform.api.gallery.service.GalleryService;
import com.photographplatform.api.portfolio.service.R2StorageService;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit-level verification of {@link GalleryService}: the owner CRUD guards and
 * the token-addressed public view. The security-critical assertion is that an
 * expired gallery is indistinguishable from one that never existed — both 404 —
 * so an anonymous visitor can't probe token validity.
 */
class GalleryServiceTest {

    private static final UUID ACTOR_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final String IP = "203.0.113.11";

    private GalleryRepository galleryRepository;
    private DeliveryPhotoRepository deliveryPhotoRepository;
    private BookingRepository bookingRepository;
    private AuditService auditService;
    private GalleryService galleryService;

    @BeforeEach
    void setUp() {
        galleryRepository = mock(GalleryRepository.class);
        deliveryPhotoRepository = mock(DeliveryPhotoRepository.class);
        bookingRepository = mock(BookingRepository.class);
        auditService = mock(AuditService.class);

        galleryService = new GalleryService(
            galleryRepository, deliveryPhotoRepository, bookingRepository,
            Optional.<R2StorageService>empty(), auditService);

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(ACTOR_ID.toString(), null));
        TenantContext.setTenant(TENANT_ID.toString());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void createRejectsUnknownBooking() {
        UUID bookingId = UUID.randomUUID();
        when(bookingRepository.existsById(bookingId)).thenReturn(false);

        assertThatThrownBy(() ->
            galleryService.create(new CreateGalleryRequest(bookingId, null, true, false), IP))
            .isInstanceOf(NotFoundException.class);

        verify(galleryRepository, never()).save(any());
    }

    @Test
    void createPersistsAndAudits() {
        UUID bookingId = UUID.randomUUID();
        when(bookingRepository.existsById(bookingId)).thenReturn(true);
        when(galleryRepository.save(any())).thenReturn(new Gallery(bookingId, null, true, false));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));

        assertThat(galleryService.create(new CreateGalleryRequest(bookingId, null, true, false), IP))
            .isNotNull();

        verify(galleryRepository).save(any());
        verify(auditService).log(
            eq("GALLERY_CREATED"), eq("GALLERY"), any(), eq(TENANT_ID), eq(ACTOR_ID), eq(IP));
    }

    @Test
    void updateRejectsUnknownGallery() {
        UUID id = UUID.randomUUID();
        when(galleryRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
            galleryService.update(id, new UpdateGalleryRequest(null, false, null), IP))
            .isInstanceOf(NotFoundException.class);

        verify(galleryRepository, never()).save(any());
    }

    @Test
    void updateAppliesFieldsAndAudits() {
        UUID id = UUID.randomUUID();
        Gallery gallery = new Gallery(UUID.randomUUID(), null, true, false);
        when(galleryRepository.findById(id)).thenReturn(Optional.of(gallery));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));

        galleryService.update(id, new UpdateGalleryRequest(null, false, true), IP);

        assertThat(gallery.getDownloadEnabled()).isFalse();
        assertThat(gallery.getWatermarkEnabled()).isTrue();
        verify(galleryRepository).save(gallery);
        verify(auditService).log(
            eq("GALLERY_UPDATED"), eq("GALLERY"), eq(id), eq(TENANT_ID), eq(ACTOR_ID), eq(IP));
    }

    @Test
    void deleteRejectsUnknownGallery() {
        UUID id = UUID.randomUUID();
        when(galleryRepository.existsById(id)).thenReturn(false);

        assertThatThrownBy(() -> galleryService.delete(id, IP))
            .isInstanceOf(NotFoundException.class);

        verify(galleryRepository, never()).deleteById(any());
    }

    @Test
    void deleteRemovesAndAudits() {
        UUID id = UUID.randomUUID();
        when(galleryRepository.existsById(id)).thenReturn(true);

        galleryService.delete(id, IP);

        verify(galleryRepository).deleteById(id);
        verify(auditService).log(
            eq("GALLERY_DELETED"), eq("GALLERY"), eq(id), eq(TENANT_ID), eq(ACTOR_ID), eq(IP));
    }

    @Test
    void publicViewRejectsUnknownToken() {
        when(galleryRepository.findByAccessToken("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> galleryService.getPublicByToken("nope", "Anna"))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void publicViewTreatsExpiredGalleryAsNotFound() {
        Gallery expired = new Gallery(
            UUID.randomUUID(), OffsetDateTime.now().minusDays(1), true, false);
        when(galleryRepository.findByAccessToken("tok")).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> galleryService.getPublicByToken("tok", "Anna"))
            .isInstanceOf(NotFoundException.class);

        // No view registered on an expired gallery — it must look like it never existed.
        verify(galleryRepository, never()).save(any());
    }
}
