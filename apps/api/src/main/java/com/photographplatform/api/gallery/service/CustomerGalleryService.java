package com.photographplatform.api.gallery.service;

import com.photographplatform.api.booking.dto.CustomerBookingResponse;
import com.photographplatform.api.booking.service.BookingQueryService;
import com.photographplatform.api.common.util.Paging;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.dto.CustomerGalleryResponse;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The client's own galleries, for the portal.
 *
 * <p>Until this existed the portal's Galleries page could only ever say "none
 * yet": a client reached their photos solely through the link in the
 * photographer's email, and lost them with it.
 *
 * <p>Ownership is not decided here. The bookings come from {@link
 * BookingQueryService#getOwnBookings}, the one place that knows how a booking
 * belongs to a customer (their account, or their address while no account is
 * linked), and a gallery is theirs only through one of those bookings. RLS
 * still confines every query to the tenant the token belongs to.
 *
 * <p>Shown: galleries that are reachable and hold at least one photo. An
 * expired one would only open on the tombstone, and an empty one is a gallery
 * the photographer has created but not filled — showing it would announce
 * photos that are not there yet.
 */
@Service
public class CustomerGalleryService {

    private final BookingQueryService bookingQueryService;
    private final GalleryRepository galleryRepository;
    private final DeliveryPhotoRepository deliveryPhotoRepository;
    private final GalleryService galleryService;
    private final Clock clock;

    public CustomerGalleryService(BookingQueryService bookingQueryService,
                                  GalleryRepository galleryRepository,
                                  DeliveryPhotoRepository deliveryPhotoRepository,
                                  GalleryService galleryService,
                                  Clock clock) {
        this.bookingQueryService = bookingQueryService;
        this.galleryRepository = galleryRepository;
        this.deliveryPhotoRepository = deliveryPhotoRepository;
        this.galleryService = galleryService;
        this.clock = clock;
    }

    /**
     * Newest shoot first. Two small queries per gallery (count, cover) rather
     * than one batched projection: one client's galleries with one studio are a
     * handful, and the cover has to go through the watermark rule per photo
     * anyway.
     */
    @Transactional(readOnly = true)
    public List<CustomerGalleryResponse> listForCustomer() {
        Map<UUID, CustomerBookingResponse> bookings = bookingQueryService
            .getOwnBookings(null, 0, Paging.MAX_PAGE_SIZE)
            .stream()
            .collect(Collectors.toMap(CustomerBookingResponse::id, Function.identity(), (a, b) -> a));
        if (bookings.isEmpty()) {
            return List.of();
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        return galleryRepository.findByBookingIdIn(bookings.keySet()).stream()
            .filter(g -> g.isReachable(now))
            .map(g -> toResponse(g, bookings.get(g.getBookingId())))
            .filter(r -> r.photoCount() > 0)
            .sorted(Comparator.comparing(
                CustomerGalleryResponse::shootDate, Comparator.nullsLast(Comparator.<LocalDate>reverseOrder())))
            .toList();
    }

    private CustomerGalleryResponse toResponse(Gallery gallery, CustomerBookingResponse booking) {
        long photoCount = deliveryPhotoRepository.countByGalleryId(gallery.getId());
        return new CustomerGalleryResponse(
            gallery.getId(),
            gallery.getBookingId(),
            booking == null ? null : booking.eventType(),
            booking == null ? null : booking.eventDate(),
            photoCount,
            Boolean.TRUE.equals(gallery.getDownloadEnabled()),
            gallery.getExpiresAt(),
            gallery.getAccessToken(),
            photoCount > 0 ? galleryService.clientCoverUrl(gallery) : null);
    }
}
