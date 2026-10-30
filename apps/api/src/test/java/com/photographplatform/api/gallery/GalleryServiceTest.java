package com.photographplatform.api.gallery;

import com.photographplatform.api.common.security.RateLimiter;
import com.photographplatform.api.entitlement.domain.Capability;
import com.photographplatform.api.entitlement.domain.Entitlements;
import com.photographplatform.api.entitlement.domain.TenantAccess;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.gallery.dto.PublicGalleryResponse;
import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.SubscriptionStatus;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.branding.service.BrandingService;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.dto.CreateGalleryRequest;
import com.photographplatform.api.gallery.dto.UpdateGalleryRequest;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository.GalleryStatsView;
import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import com.photographplatform.api.gallery.service.DeliveryPhotoProcessor;
import com.photographplatform.api.gallery.service.GalleryService;
import com.photographplatform.api.portfolio.config.R2Properties;
import com.photographplatform.api.portfolio.service.R2StorageService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
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
    private static final Clock FIXED_CLOCK =
        Clock.fixed(Instant.parse("2026-08-22T10:00:00Z"), ZoneOffset.UTC);
    private static final OffsetDateTime NOW = OffsetDateTime.now(FIXED_CLOCK);

    private GalleryRepository galleryRepository;
    private DeliveryPhotoRepository deliveryPhotoRepository;
    private BookingRepository bookingRepository;
    private AuditService auditService;
    private DeliveryPhotoProcessor photoProcessor;
    private EntitlementService entitlementService;
    private BrandingService brandingService;
    /** Permissive by default — the download quota has its own test. */
    private RateLimiter rateLimiter;
    private GalleryService galleryService;

    @BeforeEach
    void setUp() {
        galleryRepository = mock(GalleryRepository.class);
        deliveryPhotoRepository = mock(DeliveryPhotoRepository.class);
        bookingRepository = mock(BookingRepository.class);
        auditService = mock(AuditService.class);
        photoProcessor = mock(DeliveryPhotoProcessor.class);
        // Retention now comes from the plan, so create() asks for it. Starter's
        // 60 days keeps these assertions readable; the retention rules
        // themselves are covered in GalleryRetentionIT.
        entitlementService = mock(EntitlementService.class);
        when(entitlementService.accessForCurrentTenant()).thenReturn(new TenantAccess(
            new Entitlements(Plan.STARTER, EnumSet.noneOf(Capability.class), 60, 1, 200, 0L),
            true, null, null, SubscriptionStatus.TRIALING));

        // Branding rides along on the public gallery payload; these tests are
        // about retention and access, so it only has to not be null.
        brandingService = mock(BrandingService.class);

        rateLimiter = mock(RateLimiter.class);

        galleryService = new GalleryService(
            galleryRepository, deliveryPhotoRepository, bookingRepository,
            Optional.<R2StorageService>empty(), auditService, photoProcessor,
            entitlementService, FIXED_CLOCK, rateLimiter, new R2Properties(), brandingService);

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
            galleryService.create(new CreateGalleryRequest(bookingId, true, false), IP))
            .isInstanceOf(NotFoundException.class);

        verify(galleryRepository, never()).save(any());
    }

    @Test
    void createPersistsAndAudits() {
        UUID bookingId = UUID.randomUUID();
        when(bookingRepository.existsById(bookingId)).thenReturn(true);
        when(galleryRepository.save(any())).thenReturn(new Gallery(bookingId, NOW, 60, true, false));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));

        assertThat(galleryService.create(new CreateGalleryRequest(bookingId, true, false), IP))
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
            galleryService.update(id, new UpdateGalleryRequest(false, null), IP))
            .isInstanceOf(NotFoundException.class);

        verify(galleryRepository, never()).save(any());
    }

    @Test
    void updateAppliesFieldsAndAudits() {
        UUID id = UUID.randomUUID();
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, true, false);
        when(galleryRepository.findById(id)).thenReturn(Optional.of(gallery));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));

        galleryService.update(id, new UpdateGalleryRequest(false, true), IP);

        assertThat(gallery.getDownloadEnabled()).isFalse();
        assertThat(gallery.getWatermarkEnabled()).isTrue();
        verify(galleryRepository).save(gallery);
        verify(auditService).log(
            eq("GALLERY_UPDATED"), eq("GALLERY"), eq(id), eq(TENANT_ID), eq(ACTOR_ID), eq(IP));
    }

    @Test
    void deleteRejectsUnknownGallery() {
        UUID id = UUID.randomUUID();
        when(galleryRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> galleryService.delete(id, IP))
            .isInstanceOf(NotFoundException.class);

        verify(galleryRepository, never()).delete(any());
    }

    @Test
    void deleteRemovesAndAudits() {
        UUID id = UUID.randomUUID();
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, true, false);
        when(galleryRepository.findById(id)).thenReturn(Optional.of(gallery));

        galleryService.delete(id, IP);

        verify(galleryRepository).delete(gallery);
        verify(auditService).log(
            eq("GALLERY_DELETED"), eq("GALLERY"), eq(id), eq(TENANT_ID), eq(ACTOR_ID), eq(IP));
    }

    /**
     * The rows went by cascade; the files used to stay in storage forever,
     * unreferenced, after the photographer had been told the gallery was gone.
     */
    @Test
    void deletingAGalleryAlsoDeletesEveryFileItsPhotosOwn() {
        R2StorageService r2 = mock(R2StorageService.class);
        GalleryService withStorage = new GalleryService(
            galleryRepository, deliveryPhotoRepository, bookingRepository,
            Optional.of(r2), auditService, photoProcessor, entitlementService, FIXED_CLOCK,
            rateLimiter, new R2Properties(), brandingService);
        UUID id = UUID.randomUUID();
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, true, true);
        DeliveryPhoto marked = new DeliveryPhoto(id, "t/g/a.jpg", "a.jpg");
        marked.setThumbnailKey("t/g/thumb_a.jpg");
        marked.setWatermarkKey("t/g/wm_a.jpg");
        DeliveryPhoto plain = new DeliveryPhoto(id, "t/g/b.jpg", "b.jpg");
        when(galleryRepository.findById(id)).thenReturn(Optional.of(gallery));
        when(deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(any(), any()))
            .thenReturn(List.of(marked, plain));

        withStorage.delete(id, IP);

        ArgumentCaptor<List<String>> keys = ArgumentCaptor.forClass(List.class);
        verify(r2).deleteObjects(keys.capture());
        assertThat(keys.getValue()).containsExactlyInAnyOrder(
            "t/g/a.jpg", "t/g/thumb_a.jpg", "t/g/wm_a.jpg", "t/g/thumb_wm_a.jpg", "t/g/b.jpg");
    }

    /** By then the rows are gone for good; a storage outage must not report the delete as failed. */
    @Test
    void aStorageFailureAfterDeletingAGalleryIsLoggedNotThrown() {
        R2StorageService r2 = mock(R2StorageService.class);
        doThrow(new IllegalStateException("R2 down")).when(r2).deleteObjects(any());
        GalleryService withStorage = new GalleryService(
            galleryRepository, deliveryPhotoRepository, bookingRepository,
            Optional.of(r2), auditService, photoProcessor, entitlementService, FIXED_CLOCK,
            rateLimiter, new R2Properties(), brandingService);
        UUID id = UUID.randomUUID();
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, true, false);
        when(galleryRepository.findById(id)).thenReturn(Optional.of(gallery));
        when(deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(any(), any()))
            .thenReturn(List.of(new DeliveryPhoto(id, "t/g/a.jpg", "a.jpg")));

        withStorage.delete(id, IP);

        verify(galleryRepository).delete(gallery);
    }

    @Test
    void publicViewRejectsUnknownToken() {
        when(galleryRepository.findByAccessToken("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> galleryService.getPublicByToken("nope", "Anna"))
            .isInstanceOf(NotFoundException.class);
    }

    /**
     * Changed deliberately with ADR-001: an expired gallery now answers with a
     * tombstone rather than a 404.
     *
     * <p>The old reasoning was that a 404 stops an anonymous visitor probing
     * token validity. That trade does not apply here — the URL carries a
     * 64-character capability secret, so anyone who can read this response
     * already held the link, and a bare 404 just reads as a broken one and
     * becomes a support ticket for the photographer (ADR-001 §5).
     */
    @Test
    void publicViewOfAnExpiredGalleryReturnsATombstoneWithNoPhotos() {
        Gallery expired = new Gallery(
            UUID.randomUUID(), NOW.minusDays(61), 60, true, false);
        when(galleryRepository.findByAccessToken("tok")).thenReturn(Optional.of(expired));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));

        PublicGalleryResponse response = galleryService.getPublicByToken("tok", "Anna");

        assertThat(response.expired()).isTrue();
        assertThat(response.photos()).isEmpty();
        assertThat(response.expiresAt()).isEqualTo(NOW.minusDays(1));
        // Nothing that would help someone browse it anyway.
        assertThat(response.downloadEnabled()).isFalse();

        // No view registered on an expired gallery — it must look like it never existed.
        verify(galleryRepository, never()).save(any());
    }

    // ── watermarking ─────────────────────────────────────────────────────────

    @Test
    void switchingWatermarkOnBackfillsPhotosUploadedBeforeTheChange() {
        UUID id = UUID.randomUUID();
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, true, false);
        when(galleryRepository.findById(id)).thenReturn(Optional.of(gallery));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));

        galleryService.update(id, new UpdateGalleryRequest(null, true), IP);

        // Otherwise the setting would silently apply only to future uploads.
        verify(photoProcessor).backfillWatermarks(id, TENANT_ID.toString());
    }

    @Test
    void reSavingAnAlreadyWatermarkedGalleryDoesNotReprocess() {
        UUID id = UUID.randomUUID();
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, true, true);
        when(galleryRepository.findById(id)).thenReturn(Optional.of(gallery));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));

        galleryService.update(id, new UpdateGalleryRequest(false, true), IP);

        verify(photoProcessor, never()).backfillWatermarks(any(), any());
    }

    @Test
    void switchingWatermarkOffDoesNotBackfill() {
        UUID id = UUID.randomUUID();
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, true, true);
        when(galleryRepository.findById(id)).thenReturn(Optional.of(gallery));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));

        galleryService.update(id, new UpdateGalleryRequest(null, false), IP);

        verify(photoProcessor, never()).backfillWatermarks(any(), any());
    }

    /**
     * The security-critical one. A watermarked gallery must never serve the
     * untouched original, so a photo whose derivative has not been produced yet
     * (or whose processing failed) is withheld rather than falling back.
     */
    @Test
    void watermarkedGalleryWithholdsPhotosThatHaveNoDerivativeYet() {
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, true, true);
        when(galleryRepository.findByAccessToken("tok")).thenReturn(Optional.of(gallery));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));

        DeliveryPhoto processed = new DeliveryPhoto(gallery.getId(), "t/g/a.jpg", "a.jpg");
        processed.setWatermarkKey("t/g/wm_a.jpg");
        DeliveryPhoto stillProcessing = new DeliveryPhoto(gallery.getId(), "t/g/b.jpg", "b.jpg");

        when(deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(any(), any()))
            .thenReturn(List.of(processed, stillProcessing));

        var response = galleryService.getPublicByToken("tok", "Anna");

        assertThat(response.photos())
            .as("only the photo with a watermarked derivative may be served")
            .hasSize(1);
        assertThat(response.photos().get(0).originalFilename()).isEqualTo("a.jpg");
    }

    @Test
    void unwatermarkedGalleryServesEveryPhoto() {
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, true, false);
        when(galleryRepository.findByAccessToken("tok")).thenReturn(Optional.of(gallery));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));
        when(deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(any(), any())).thenReturn(List.of(
            new DeliveryPhoto(gallery.getId(), "t/g/a.jpg", "a.jpg"),
            new DeliveryPhoto(gallery.getId(), "t/g/b.jpg", "b.jpg")));

        assertThat(galleryService.getPublicByToken("tok", "Anna").photos()).hasSize(2);
    }

    // ── delete ───────────────────────────────────────────────────────────────

    @Test
    void deletePhotoRemovesTheRowAndEveryDerivativeObject() {
        R2StorageService r2 = mock(R2StorageService.class);
        GalleryService withStorage = new GalleryService(
            galleryRepository, deliveryPhotoRepository, bookingRepository,
            Optional.of(r2), auditService, photoProcessor, entitlementService, FIXED_CLOCK,
            rateLimiter, new R2Properties(), brandingService);

        UUID photoId = UUID.randomUUID();
        DeliveryPhoto photo = new DeliveryPhoto(UUID.randomUUID(), "t/g/a.jpg", "a.jpg");
        photo.setThumbnailKey("t/g/thumb_a.jpg");
        photo.setWatermarkKey("t/g/wm_a.jpg");
        when(deliveryPhotoRepository.findById(photoId)).thenReturn(Optional.of(photo));

        withStorage.deletePhoto(photoId, IP);

        verify(deliveryPhotoRepository).delete(photo);

        ArgumentCaptor<List<String>> keys = ArgumentCaptor.forClass(List.class);
        verify(r2).deleteObjects(keys.capture());
        assertThat(keys.getValue())
            .as("the watermarked copy has a thumbnail of its own — all four must go")
            .containsExactlyInAnyOrder(
                "t/g/a.jpg", "t/g/thumb_a.jpg", "t/g/wm_a.jpg", "t/g/thumb_wm_a.jpg");
    }

    @Test
    void deletePhotoRejectsUnknownId() {
        UUID photoId = UUID.randomUUID();
        when(deliveryPhotoRepository.findById(photoId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> galleryService.deletePhoto(photoId, IP))
            .isInstanceOf(NotFoundException.class);

        verify(deliveryPhotoRepository, never()).delete(any());
    }

    // ── download ─────────────────────────────────────────────────────────────

    @Test
    void downloadIsNotFoundWhenTheGalleryHasDownloadsDisabled() {
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, false, false);
        when(galleryRepository.findByAccessToken("tok")).thenReturn(Optional.of(gallery));

        // 404 rather than 403: a distinguishable response would confirm to an
        // anonymous visitor that the token is real.
        assertThatThrownBy(() -> galleryService.prepareDownload("tok"))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void downloadIsNotFoundWhenTheGalleryHasExpired() {
        Gallery expired = new Gallery(
            UUID.randomUUID(), NOW.minusDays(61), 60, true, false);
        when(galleryRepository.findByAccessToken("tok")).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> galleryService.prepareDownload("tok"))
            .isInstanceOf(NotFoundException.class);
    }

    @Test
    void downloadOfAWatermarkedGalleryShipsTheMarkedCopiesOnly() {
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, true, true);
        when(galleryRepository.findByAccessToken("tok")).thenReturn(Optional.of(gallery));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));

        DeliveryPhoto processed = new DeliveryPhoto(gallery.getId(), "t/g/a.png", "shot.png");
        processed.setWatermarkKey("t/g/wm_a.jpg");
        DeliveryPhoto stillProcessing = new DeliveryPhoto(gallery.getId(), "t/g/b.jpg", "b.jpg");
        when(deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(any(), any()))
            .thenReturn(List.of(processed, stillProcessing));

        var plan = galleryService.prepareDownload("tok");

        assertThat(plan.entries()).hasSize(1);
        assertThat(plan.entries().get(0).r2Key())
            .as("never the untouched original")
            .isEqualTo("t/g/wm_a.jpg");
        assertThat(plan.entries().get(0).filename())
            .as("the derivative is re-encoded as JPEG, so the name must not claim .png")
            .isEqualTo("shot.jpg");
    }

    @Test
    void downloadDeDuplicatesCollidingCameraFilenames() {
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, true, false);
        when(galleryRepository.findByAccessToken("tok")).thenReturn(Optional.of(gallery));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));
        when(deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(any(), any())).thenReturn(List.of(
            new DeliveryPhoto(gallery.getId(), "t/g/a.jpg", "IMG_0001.JPG"),
            new DeliveryPhoto(gallery.getId(), "t/g/b.jpg", "IMG_0001.JPG"),
            new DeliveryPhoto(gallery.getId(), "t/g/c.jpg", "IMG_0001.JPG")));

        var plan = galleryService.prepareDownload("tok");

        // Two identical entry names make an archive that silently loses a photo.
        assertThat(plan.entries()).extracting(e -> e.filename())
            .containsExactly("IMG_0001.JPG", "IMG_0001 (2).JPG", "IMG_0001 (3).JPG");
    }

    @Test
    void downloadStripsPathSeparatorsFromUploadedFilenames() {
        Gallery gallery = new Gallery(UUID.randomUUID(), NOW, 60, true, false);
        when(galleryRepository.findByAccessToken("tok")).thenReturn(Optional.of(gallery));
        when(galleryRepository.findStatsById(any())).thenReturn(Optional.of(mock(GalleryStatsView.class)));
        when(deliveryPhotoRepository.findByGalleryIdOrderBySortOrderAsc(any(), any())).thenReturn(List.of(
            new DeliveryPhoto(gallery.getId(), "t/g/a.jpg", "../../../etc/passwd.jpg")));

        var plan = galleryService.prepareDownload("tok");

        // Zip-Slip: a separator in an entry name lets a careless extractor
        // write outside the target directory.
        assertThat(plan.entries().get(0).filename()).doesNotContain("/").doesNotContain("..");
    }
}
