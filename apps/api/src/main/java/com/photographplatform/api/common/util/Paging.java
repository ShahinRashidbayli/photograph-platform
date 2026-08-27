package com.photographplatform.api.common.util;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

/**
 * Bounds on caller-supplied paging.
 *
 * <p>Every list endpoint took {@code page}/{@code size} straight from the query
 * string into {@code PageRequest.of}, so {@code ?size=100000} pulled a whole
 * tenant in one request and a negative {@code page} reached the database layer
 * before anything rejected it.
 *
 * <p>Oversized requests are <em>refused</em>, not clamped, and that is the whole
 * point of the class. The clients here page by asking for {@code size} rows and
 * stopping when they get back fewer than they asked for (see {@code
 * useBookings.ts}) — silently serving 200 rows to a caller that asked for 500
 * would read as "that was the last page" and drop everything after it. A 422
 * that names the limit is wrong loudly; a clamp is wrong quietly.
 */
public final class Paging {

    /**
     * Comfortably above the largest page any current client asks for (100, in
     * {@code useBookings.ts} and the gallery booking picker) so raising the
     * frontend's page size stays a frontend decision, and far below the point
     * where a single response becomes a way to tie up the database.
     */
    public static final int MAX_PAGE_SIZE = 200;

    private Paging() {
    }

    /**
     * @throws IllegalArgumentException — mapped to 422 by {@code
     *     GlobalExceptionHandler}, which is where hand-rolled input validation
     *     lands for the rest of this codebase
     */
    public static PageRequest of(int page, int size, Sort sort) {
        if (page < 0) {
            throw new IllegalArgumentException("page must not be negative");
        }
        if (size < 1) {
            throw new IllegalArgumentException("size must be at least 1");
        }
        if (size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException(
                "size must not exceed " + MAX_PAGE_SIZE + " (requested " + size + ")");
        }
        return PageRequest.of(page, size, sort);
    }
}
