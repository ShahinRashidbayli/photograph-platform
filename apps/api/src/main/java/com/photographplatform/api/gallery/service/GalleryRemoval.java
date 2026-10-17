package com.photographplatform.api.gallery.service;

import com.photographplatform.api.common.repository.QueryLimits;
import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import com.photographplatform.api.gallery.domain.Gallery;
import com.photographplatform.api.gallery.repository.DeliveryPhotoRepository;
import com.photographplatform.api.gallery.repository.GalleryRepository;
import com.photographplatform.api.portfolio.service.R2StorageService;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Deleting a gallery means deleting its photos — the files, not just the rows.
 *
 * <p>Shared by the photographer's own delete and by Art. 17 erasure, so the
 * two cannot drift. Before this existed, deleting a gallery removed the rows
 * (the photos by {@code ON DELETE CASCADE}) and nothing else: every original,
 * thumbnail and watermarked copy stayed in object storage, unreferenced and
 * billed, while the photographer was told the gallery was gone. For a delivery
 * of someone's wedding that is personal data kept with no record of it.
 *
 * <h2>Order</h2>
 * Rows now, objects after commit — the same order as {@code deletePhoto} and
 * for the same reason: deleting objects inside a transaction that then rolls
 * back leaves rows pointing at bytes that no longer exist. The cost is the
 * opposite failure, objects outliving their rows if storage is down at that
 * moment; that is logged with every key so it can be cleaned up by hand.
 */
final class GalleryRemoval {

    private static final Logger LOG = LoggerFactory.getLogger(GalleryRemoval.class);

    private GalleryRemoval() {
    }

    /**
     * Deletes {@code gallery} and, once the surrounding transaction commits,
     * every object its photos own.
     *
     * @return how many photos the gallery held
     */
    static int remove(Gallery gallery, GalleryRepository galleries, DeliveryPhotoRepository photos,
                      Optional<R2StorageService> storage) {
        List<DeliveryPhoto> held = photos.findByGalleryIdOrderBySortOrderAsc(gallery.getId(), QueryLimits.LIST);
        List<String> keys = held.stream()
            .flatMap(photo -> DeliveryPhotoKeys.of(photo).stream())
            .filter(Objects::nonNull)
            .toList();
        // delivery_photos and gallery_expiry_reminders go with it by ON DELETE CASCADE.
        galleries.delete(gallery);
        deleteFilesAfterCommit(keys, storage, "gallery " + gallery.getId());
        return held.size();
    }

    /**
     * Deletes {@code keys} from storage once the current transaction has
     * committed, or straight away when there is none.
     *
     * <p>A failure here is logged, not thrown. By the time it runs the rows are
     * gone for good, so an exception could only turn a delete that happened
     * into an error response that says it did not.
     */
    static void deleteFilesAfterCommit(List<String> keys, Optional<R2StorageService> storage, String owner) {
        if (keys.isEmpty() || storage.isEmpty()) {
            return;
        }
        Runnable delete = () -> {
            try {
                storage.get().deleteObjects(keys);
            } catch (RuntimeException ex) {
                LOG.error("Rows for {} are deleted but its {} objects could not be removed from storage "
                    + "and are now orphaned: {}", owner, keys.size(), keys, ex);
            }
        };
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            delete.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                delete.run();
            }
        });
    }
}
