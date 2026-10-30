package com.photographplatform.api.common.repository;

import org.springframework.data.domain.Limit;

/**
 * Upper bounds for queries that return a whole collection at once.
 *
 * <h2>Why a cap and not pagination</h2>
 * These lists are genuinely meant to be shown in full — a photographer's client
 * directory, their portfolio, the photos in one gallery. Paginating them would
 * change the product, and none of them is unbounded in the dangerous sense:
 * RLS scopes every one to a single tenant, so no query here can ever walk the
 * whole table.
 *
 * <p>What they lack is a ceiling. "One tenant's rows" is a bound in principle
 * and not in practice: a wedding gallery is routinely several hundred photos,
 * and a portfolio accumulates for years. Without a limit the failure mode is a
 * response that grows until it takes the heap or the request timeout with it,
 * and it arrives on the busiest account rather than the quietest.
 *
 * <p>So the cap is deliberately far above any real usage. It is not a feature
 * limit and no user should ever meet it; it is the line past which something
 * has gone wrong and should fail loudly on one request instead of quietly
 * degrading the service for everyone.
 */
public final class QueryLimits {

    /**
     * Applies to the directory-style lists: clients, galleries, portfolio
     * photos, the photos in one gallery.
     */
    public static final int MAX_LIST_ROWS = 2000;

    public static final Limit LIST = Limit.of(MAX_LIST_ROWS);

    private QueryLimits() {
    }
}
