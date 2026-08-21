package com.photographplatform.api.gallery.service;

import com.photographplatform.api.gallery.dto.GalleryDownloadPlan;
import com.photographplatform.api.portfolio.service.R2StorageService;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Optional;
import java.util.zip.Deflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Streams a client gallery to the browser as a ZIP.
 *
 * <p>Written straight to the response socket, one object at a time: a wedding
 * delivery is routinely several gigabytes, so neither the archive nor any
 * single photo is ever held in memory or staged on disk. Peak usage per
 * download is one 64KB buffer.
 */
@Service
public class GalleryArchiveWriter {

    private static final Logger LOG = LoggerFactory.getLogger(GalleryArchiveWriter.class);
    private static final int BUFFER_BYTES = 64 * 1024;

    private final Optional<R2StorageService> storage;

    public GalleryArchiveWriter(Optional<R2StorageService> storage) {
        this.storage = storage;
    }

    /**
     * Writes every entry in {@code plan} into {@code target}.
     *
     * <p>Two failures are handled differently, on purpose:
     *
     * <ul>
     *   <li><strong>Opening a photo fails</strong> (missing object, storage
     *       error) — the photo is skipped and the archive continues. The
     *       response is already committed with a 200 and a filename, so there
     *       is no way to turn this into an error page, and a client who asked
     *       for 400 photos is better served by 399 than by nothing.</li>
     *   <li><strong>A read fails partway through a photo</strong> — the whole
     *       archive is aborted. Skipping is not possible once bytes are out:
     *       they cannot be un-written, and the next {@code putNextEntry} would
     *       finalise them into a structurally valid ZIP member holding a
     *       truncated image. The client would extract a corrupt photo with
     *       nothing to indicate it. Throwing instead breaks the response
     *       mid-body, which browsers surface as a failed download.</li>
     * </ul>
     */
    public void writeTo(GalleryDownloadPlan plan, OutputStream target) throws IOException {
        R2StorageService r2 = storage.orElseThrow(
            () -> new IllegalStateException("R2 storage not configured"));

        try (ZipOutputStream zip = new ZipOutputStream(target)) {
            // JPEGs are already compressed; deflating them again burns CPU for
            // roughly nothing. Level 0 keeps the ZIP container without paying
            // for compression that cannot help.
            zip.setLevel(Deflater.NO_COMPRESSION);

            byte[] buffer = new byte[BUFFER_BYTES];
            int written = 0;
            int skipped = 0;
            for (GalleryDownloadPlan.Entry entry : plan.entries()) {
                InputStream opened;
                try {
                    opened = r2.openStream(entry.r2Key());
                } catch (RuntimeException e) {
                    LOG.error("Skipping {} in gallery archive: {}", entry.r2Key(), e.getMessage());
                    skipped++;
                    continue;
                }
                try (InputStream source = opened) {
                    zip.putNextEntry(new ZipEntry(entry.filename()));
                    int read;
                    while ((read = source.read(buffer)) != -1) {
                        zip.write(buffer, 0, read);
                    }
                    zip.closeEntry();
                    written++;
                } catch (IOException e) {
                    // Includes the client hanging up mid-download. Continuing
                    // would issue an R2 GET for every remaining photo and log
                    // an error for each, for a socket nobody is reading.
                    LOG.warn("Gallery archive {} aborted after {} photo(s): {}",
                        plan.archiveName(), written, e.getMessage());
                    throw e;
                }
            }
            LOG.info("Streamed gallery archive {} ({} photo(s), {} skipped)",
                plan.archiveName(), written, skipped);
        }
    }
}
