package com.photographplatform.api.gallery.dto;

import java.util.List;

/**
 * What a gallery ZIP will contain, resolved inside a short read transaction so
 * the streaming itself — which can run for minutes on a large wedding gallery
 * — happens with no database transaction held open.
 *
 * @param archiveName the filename offered to the browser
 * @param entries     one per photo, in gallery order
 */
public record GalleryDownloadPlan(String archiveName, List<Entry> entries) {

    /**
     * @param r2Key    the object to read — the watermarked derivative when the
     *                 gallery is watermarked, never the untouched original
     * @param filename the name inside the archive, already de-duplicated
     */
    public record Entry(String r2Key, String filename) {
    }
}
