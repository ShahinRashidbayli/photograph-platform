package com.photographplatform.api.portfolio.service;

import com.photographplatform.api.portfolio.repository.PhotoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Whether the current tenant's public portfolio shows anything.
 *
 * <p>Published means at least one published photo: the public page renders for
 * every studio, and a link to an empty one would send a Customer to a blank
 * gallery under the studio's name.
 *
 * <p>Its own class, not a method on {@link PhotoService}, because
 * {@code messaging} reads it and ArchUnit allows {@code messaging} this one
 * question about the portfolio, not the photo service behind it (#127).
 */
@Service
public class PortfolioPublication {

    private final PhotoRepository photoRepository;

    public PortfolioPublication(PhotoRepository photoRepository) {
        this.photoRepository = photoRepository;
    }

    /** Scoped by RLS to the tenant bound to the current transaction. */
    @Transactional(readOnly = true)
    public boolean isPublished() {
        return photoRepository.existsByIsPublishedTrue();
    }
}
