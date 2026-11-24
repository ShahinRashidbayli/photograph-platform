package com.photographplatform.api.analytics.service;

import com.photographplatform.api.analytics.dto.YearSummaryResponse;
import com.photographplatform.api.booking.service.BookingQueryService;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.BusinessZone;
import com.photographplatform.api.invoice.domain.YearSettlement;
import com.photographplatform.api.invoice.service.SettlementPeriods;
import java.time.Clock;
import java.time.Year;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Booked, Invoiced and Collected for the current year, for the dashboard.
 *
 * <p>Not plan-gated, unlike {@link AnalyticsService}: the dashboard tiles are on
 * every plan, so a STARTER studio keeps them (ADR-004, Consequences). The role
 * rule in {@code SecurityConfig} is the only gate, and it admits staff only.
 *
 * <p>Composes, and decides nothing. Booked is booking's figure and Invoiced and
 * Collected are invoice's (ADR-004 §4). Invoiced and Collected come from the
 * same {@link SettlementPeriods} year as the report, so the tile and the
 * report's year total cannot disagree; nothing is issued or paid in the
 * future, so the whole year is the year so far.
 */
@Service
public class YearSummaryService {

    private final BookingQueryService bookingQueryService;
    private final SettlementPeriods settlementPeriods;
    private final Clock clock;

    public YearSummaryService(
        BookingQueryService bookingQueryService, SettlementPeriods settlementPeriods, Clock clock) {
        this.bookingQueryService = bookingQueryService;
        this.settlementPeriods = settlementPeriods;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public YearSummaryResponse currentYear() {
        UUID tenantId = SecurityUtils.requireCurrentTenantId();
        // The studio's calendar year, not the server's: at 00:30 on 1 January
        // in Berlin it is still last year in UTC.
        int year = Year.now(clock.withZone(BusinessZone.ID)).getValue();
        YearSettlement settled = settlementPeriods.ofYear(tenantId, year);
        return new YearSummaryResponse(
            year,
            bookingQueryService.bookedCents(tenantId, year),
            settled.invoicedCents(),
            settled.collectedCents());
    }
}
