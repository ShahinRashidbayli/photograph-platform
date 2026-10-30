package com.photographplatform.api.auth.service;

import com.photographplatform.api.portfolio.service.R2StorageService;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Turns the stored avatar reference into something a browser can load.
 *
 * <p>{@code users.avatar_url} holds an R2 <em>object key</em>, not a URL. It has
 * to: the only URL R2 gives us for a private object is a pre-signed GET that
 * expires with {@code app.r2.presigned-expiry-minutes} (60 by default). Storing
 * that URL — which is what the client used to send, despite the presign
 * endpoint's javadoc warning against it and despite that endpoint returning the
 * key alongside it — meant every avatar became a 403 an hour after upload, for
 * good, with nothing in the system able to refresh it.
 *
 * <p>Signing on read instead means the URL is always valid for the lifetime of
 * the response that carries it.
 *
 * <p>Values that already look like absolute URLs are passed through untouched,
 * so rows written before this change keep rendering until they expire (and are
 * repaired the next time that user uploads a photo). Nothing needs a backfill.
 */
@Component
public class AvatarUrlResolver {

    private final Optional<R2StorageService> storage;

    public AvatarUrlResolver(Optional<R2StorageService> storage) {
        this.storage = storage;
    }

    /**
     * @param stored the raw {@code users.avatar_url} value — an object key, a
     *               legacy absolute URL, or null
     * @return a loadable URL, or null when there is no avatar (or no storage
     *         configured to sign one)
     */
    public String resolve(String stored) {
        if (stored == null || stored.isBlank()) {
            return null;
        }
        String value = stored.trim();
        if (value.startsWith("http://") || value.startsWith("https://")) {
            return value;
        }
        return storage.map(s -> s.generateDownloadUrl(value)).orElse(null);
    }
}
