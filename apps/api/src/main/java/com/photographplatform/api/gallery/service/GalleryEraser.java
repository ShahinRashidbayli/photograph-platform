package com.photographplatform.api.gallery.service;

import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.ErasureSubject;
import com.photographplatform.api.common.privacy.PersonalDataEraser;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.portfolio.service.R2StorageService;
import java.util.List;
import java.util.Optional;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deletes the galleries delivered for the subject's bookings — the photos of
 * them, which are the most personal data the studio holds.
 *
 * <p>Files are removed only once the erasure commits ({@link GalleryRemoval}),
 * so a preview — the same run, rolled back — never touches storage.
 */
@Component
@Order(400)
@Transactional(propagation = Propagation.MANDATORY)
public class GalleryEraser implements PersonalDataEraser {

    private final GalleryRepository galleryRepository;
    private final DeliveryPhotoRepository deliveryPhotoRepository;
    private final Optional<R2StorageService> storage;

    public GalleryEraser(GalleryRepository galleryRepository, DeliveryPhotoRepository deliveryPhotoRepository,
                         Optional<R2StorageService> storage) {
        this.galleryRepository = galleryRepository;
        this.deliveryPhotoRepository = deliveryPhotoRepository;
        this.storage = storage;
    }

    @Override
    public List<ErasureOutcome> erase(ErasureSubject subject) {
        if (subject.bookingIds().isEmpty()) {
            return List.of(ErasureOutcome.deleted("galleries", 0), ErasureOutcome.deleted("galleryPhotos", 0));
        }
        List<Gallery> galleries = galleryRepository.findByBookingIdIn(subject.bookingIds());
        int photos = 0;
        for (Gallery gallery : galleries) {
            photos += GalleryRemoval.remove(gallery, galleryRepository, deliveryPhotoRepository, storage);
        }
        return List.of(
            ErasureOutcome.deleted("galleries", galleries.size()),
            ErasureOutcome.deleted("galleryPhotos", photos));
    }
}
