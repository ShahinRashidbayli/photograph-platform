package com.photographplatform.api.booking.domain;

import java.util.UUID;

/**
 * The three money fields of a booking, which are only valid together.
 *
 * <p>A deposit larger than the total is a negative outstanding balance, which
 * invoice's {@code Settlement} and the invoice totals both read as
 * money the photographer owes the client. A negative total is the same kind of
 * nonsense one step earlier. Both are checked here, in the constructor, so
 * there is no way to hold an invalid combination — the rule used to live in a
 * private service method, which meant it applied to the callers that
 * remembered to go through it.
 *
 * <p>The amounts are cents, as everywhere else in this codebase: integers, no
 * rounding, no locale.
 */
public record BookingPricing(UUID packageId, int totalCents, int depositCents) {

    public BookingPricing {
        // IllegalArgumentException, which the global handler answers as 422:
        // the values contradict each other, no state stands in the way. See
        // GlobalExceptionHandler's class javadoc for why invalid input is
        // always 422 here.
        if (totalCents < 0) {
            throw new IllegalArgumentException("Total amount cannot be negative");
        }
        if (depositCents < 0) {
            throw new IllegalArgumentException("Deposit amount cannot be negative");
        }
        if (depositCents > totalCents) {
            throw new IllegalArgumentException("Deposit cannot exceed the total amount");
        }
    }

    /** No package, nothing quoted yet — what a booking from an inquiry starts as. */
    public static BookingPricing unpriced() {
        return new BookingPricing(null, 0, 0);
    }

    /**
     * Resolves the caller's intent into a valid combination.
     *
     * <p>An explicit total always wins: the photographer is overriding the
     * package default (an extra hour, a referral discount, a custom quote) and
     * that intent must not be silently replaced. Only with no explicit total
     * does the package's own price apply.
     *
     * @param packagePriceCents the linked package's price, or null when no
     *                          package is linked
     */
    public static BookingPricing resolve(
        UUID packageId, Integer packagePriceCents, Integer explicitTotalCents, Integer depositCents) {
        int total = explicitTotalCents != null
            ? explicitTotalCents
            : (packagePriceCents != null ? packagePriceCents : 0);
        return new BookingPricing(packageId, total, depositCents != null ? depositCents : 0);
    }
}
