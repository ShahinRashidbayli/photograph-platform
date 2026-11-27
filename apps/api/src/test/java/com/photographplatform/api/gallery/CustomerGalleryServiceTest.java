package com.photographplatform.api.gallery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.photographplatform.api.audit.service.AuditService;
import com.photographplatform.api.booking.dto.CustomerBookingResponse;
import com.photographplatform.api.booking.repository.BookingRepository;
import com.photographplatform.api.tenant.service.PublicTenantResolver;
import org.springframework.context.ApplicationEventPublisher;
import com.photographplatform.api.booking.service.BookingQueryService;
import com.photographplatform.api.branding.service.BrandingService;
import com.photographplatform.api.common.security.RateLimiter;
import com.photographplatform.api.entitlement.service.EntitlementService;
import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.dto.CustomerGalleryResponse;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.gallery.service.CustomerGalleryService;
import com.photographplatform.api.gallery.service.DeliveryPhotoProcessor;
import com.photographplatform.api.gallery.service.GalleryService;
import com.photographplatform.api.portfolio.config.R2Properties;
import com.photographplatform.api.portfolio.service.R2StorageService;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Limit;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * What the portal's Galleries page may show a client: only galleries of their
 * own bookings, only ones that would actually open, never an empty one — and a
 * cover that obeys the watermark exactly as the public view does.
 */
class CustomerGalleryServiceTest {

    private static final Clock CLOCK =
        Clock.fixed(Instant.parse("2026-11-08T10:00:00Z"), ZoneOffset.UTC);
    private static final OffsetDateTime NOW = OffsetDateTime.now(CLOCK);

    private BookingQueryService bookingQueryService;
    private GalleryRepository galleryRepository;
    private DeliveryPhotoRepository photoRepository;
    private CustomerGalleryService service;

    @BeforeEach
    void setUp() {
        bookingQueryService = mock(BookingQueryService.class);
        galleryRepository = mock(GalleryRepository.class);
        photoRepository = mock(DeliveryPhotoRepository.class);

        R2StorageService storage = mock(R2StorageService.class);
        when(storage.generateDownloadUrl(anyString())).thenAnswer(inv -> "signed:" + inv.getArgument(0));

        GalleryService galleryService = new GalleryService(
            galleryRepository, photoRepository, mock(BookingRepository.class),
            Optional.of(storage), mock(AuditService.class), mock(DeliveryPhotoProcessor.class),
            mock(EntitlementService.class), CLOCK, mock(RateLimiter.class), new R2Properties(),
            mock(BrandingService.class), bookingQueryService, mock(PublicTenantResolver.class),
            mock(ApplicationEventPublisher.class));

        service = new CustomerGalleryService(
            bookingQueryService, galleryRepository, photoRepository, galleryService, CLOCK);
    }

    private static CustomerBookingResponse booking(UUID id, String type, LocalDate date) {
        return new CustomerBookingResponse(id, "Anna Schneider", "anna@example.test", date, null,
            type, null, null, 100_000, 30_000, "COMPLETED", "PAID", 100_000, NOW.minusMonths(3));
    }

    private static Gallery gallery(UUID bookingId, boolean watermarked) {
        Gallery g = new Gallery(bookingId, NOW.minusDays(10), 60, true, watermarked);
        ReflectionTestUtils.setField(g, "id", UUID.randomUUID());
        return g;
    }

    private void photos(Gallery g, long count, DeliveryPhoto first) {
        when(photoRepository.countByGalleryId(g.getId())).thenReturn(count);
        when(photoRepository.findByGalleryIdOrderBySortOrderAsc(eq(g.getId()), any(Limit.class)))
            .thenReturn(first == null ? List.of() : List.of(first));
    }

    @Test
    void listsTheClientsGalleriesNewestShootFirst() {
        UUID family = UUID.randomUUID();
        UUID wedding = UUID.randomUUID();
        when(bookingQueryService.getOwnBookings(isNull(), eq(0), anyInt())).thenReturn(List.of(
            booking(family, "FAMILIE", LocalDate.of(2026, 9, 20)),
            booking(wedding, "HOCHZEIT", LocalDate.of(2026, 10, 3))));
        Gallery older = gallery(family, false);
        Gallery newer = gallery(wedding, false);
        when(galleryRepository.findByBookingIdIn(anyCollection())).thenReturn(List.of(older, newer));
        photos(older, 248, new DeliveryPhoto(older.getId(), "g/1/a.jpg", "a.jpg"));
        photos(newer, 12, new DeliveryPhoto(newer.getId(), "g/2/b.jpg", "b.jpg"));

        List<CustomerGalleryResponse> result = service.listForCustomer();

        assertThat(result).extracting(CustomerGalleryResponse::bookingId).containsExactly(wedding, family);
        CustomerGalleryResponse fam = result.get(1);
        assertThat(fam.eventType()).isEqualTo("FAMILIE");
        assertThat(fam.shootDate()).isEqualTo(LocalDate.of(2026, 9, 20));
        assertThat(fam.photoCount()).isEqualTo(248);
        assertThat(fam.accessToken()).isEqualTo(older.getAccessToken());
    }

    /** An expired gallery would only open on its tombstone; an empty one announces photos that are not there. */
    @Test
    void leavesOutExpiredAndEmptyGalleries() {
        UUID b = UUID.randomUUID();
        when(bookingQueryService.getOwnBookings(isNull(), eq(0), anyInt()))
            .thenReturn(List.of(booking(b, "PORTRAIT", LocalDate.of(2026, 10, 1))));
        Gallery expired = gallery(b, false);
        expired.setExpiresAt(NOW.minusDays(1));
        Gallery empty = gallery(b, false);
        when(galleryRepository.findByBookingIdIn(anyCollection())).thenReturn(List.of(expired, empty));
        photos(expired, 30, new DeliveryPhoto(expired.getId(), "g/e/a.jpg", "a.jpg"));
        photos(empty, 0, null);

        assertThat(service.listForCustomer()).isEmpty();
    }

    /** No bookings means nothing to look up — and no tenant-wide gallery query to get wrong. */
    @Test
    void aClientWithoutBookingsGetsNothingAndNoGalleryQuery() {
        when(bookingQueryService.getOwnBookings(isNull(), eq(0), anyInt())).thenReturn(List.of());

        assertThat(service.listForCustomer()).isEmpty();
        verify(galleryRepository, never()).findByBookingIdIn(anyCollection());
    }

    /**
     * The portal must not be the way round the watermark: a watermarked
     * gallery's cover is the watermarked thumbnail, and while that does not
     * exist yet there is no cover at all — never the original.
     */
    @Test
    void aWatermarkedGalleryNeverShowsTheOriginalAsItsCover() {
        UUID b = UUID.randomUUID();
        when(bookingQueryService.getOwnBookings(isNull(), eq(0), anyInt()))
            .thenReturn(List.of(booking(b, "HOCHZEIT", LocalDate.of(2026, 10, 3))));
        Gallery processed = gallery(b, true);
        Gallery pending = gallery(b, true);
        when(galleryRepository.findByBookingIdIn(anyCollection())).thenReturn(List.of(processed, pending));

        DeliveryPhoto marked = new DeliveryPhoto(processed.getId(), "g/p/orig.jpg", "orig.jpg");
        marked.setThumbnailKey("g/p/orig_thumb.jpg");
        marked.setWatermarkKey("g/p/wm.jpg");
        photos(processed, 5, marked);
        DeliveryPhoto unprocessed = new DeliveryPhoto(pending.getId(), "g/q/orig.jpg", "orig.jpg");
        unprocessed.setThumbnailKey("g/q/orig_thumb.jpg");
        photos(pending, 5, unprocessed);

        List<CustomerGalleryResponse> result = service.listForCustomer();

        assertThat(result).hasSize(2);
        assertThat(result).extracting(CustomerGalleryResponse::coverUrl)
            .noneMatch(url -> url != null && url.contains("orig"));
        assertThat(result).filteredOn(r -> r.id().equals(processed.getId()))
            .singleElement().satisfies(r -> assertThat(r.coverUrl()).isEqualTo("signed:g/p/thumb_wm.jpg"));
        assertThat(result).filteredOn(r -> r.id().equals(pending.getId()))
            .singleElement().satisfies(r -> assertThat(r.coverUrl()).isNull());
    }
}
