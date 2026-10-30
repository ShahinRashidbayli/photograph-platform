package com.photographplatform.api.booking.service;

import com.photographplatform.api.booking.domain.BookingPricing;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.pricing.repository.PackageRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * The one part of pricing that needs the database: whether the package exists,
 * and at what price. Everything else — precedence, and which amounts may
 * coexist — is {@link BookingPricing}, which needs nothing.
 *
 * <p>Its own component because both write paths need it and they are now
 * separate services: {@code BookingCommandService} for bookings the
 * photographer creates and edits, {@code BookingConversionService} for the
 * ones a lead or an inquiry turns into. A service-to-service call for five
 * lines would couple them for no reason.
 */
@Component
public class BookingPricingResolver {

    private final PackageRepository packageRepository;

    public BookingPricingResolver(PackageRepository packageRepository) {
        this.packageRepository = packageRepository;
    }

    /**
     * Resolves the caller's pricing intent, refusing a {@code packageId} that
     * is not this tenant's.
     *
     * <p>The package is looked up <em>whether or not</em> its price is used,
     * and that is the point. This used to return early on an explicit total, so
     * {@code package_id} was written without anyone having checked it: an
     * unknown id then failed at the foreign key and surfaced as a baffling 409
     * "Resource already exists", and — worse — another tenant's package id
     * satisfies that foreign key perfectly and was stored without a word. The
     * lookup goes through RLS, which is what makes a cross-tenant id a 404.
     */
    public BookingPricing resolve(UUID packageId, Integer totalCents, Integer depositCents) {
        Integer packagePrice = null;
        if (packageId != null) {
            packagePrice = packageRepository.findById(packageId)
                // Failing closed beats silently zero-pricing a wedding.
                .orElseThrow(() -> new NotFoundException("Package not found: " + packageId))
                .getPriceCents();
        }
        return BookingPricing.resolve(packageId, packagePrice, totalCents, depositCents);
    }
}
