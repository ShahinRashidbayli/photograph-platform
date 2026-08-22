package com.photographplatform.api.gallery.service;

import com.photographplatform.api.gallery.domain.DeliveryPhoto;
import com.photographplatform.api.portfolio.service.ThumbnailService;
import java.util.ArrayList;
import java.util.List;

/**
 * Every object-storage key one delivery photo owns.
 *
 * <p>Extracted so deleting a photo and purging a whole expired gallery derive
 * the same set. Two copies of this list is how orphaned bytes accumulate: a
 * derivative added in one place and forgotten in the other is invisible —
 * nothing breaks, the objects simply stay in R2 and are billed forever, for a
 * gallery the customer was told had been deleted.
 */
final class DeliveryPhotoKeys {

    private DeliveryPhotoKeys() {
    }

    static List<String> of(DeliveryPhoto photo) {
        List<String> keys = new ArrayList<>(4);
        keys.add(photo.getR2Key());
        keys.add(photo.getThumbnailKey());
        if (photo.getWatermarkKey() != null) {
            keys.add(photo.getWatermarkKey());
            keys.add(ThumbnailService.thumbnailKeyFor(photo.getWatermarkKey()));
        }
        return keys;
    }
}
