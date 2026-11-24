package com.photographplatform.api.analytics.controller;

import com.photographplatform.api.analytics.dto.AnalyticsResponse;
import com.photographplatform.api.analytics.dto.YearSummaryResponse;
import com.photographplatform.api.analytics.service.AnalyticsService;
import com.photographplatform.api.analytics.service.YearSummaryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Invoiced/Collected and booking reports — Studio's {@code ANALYTICS}
 * capability — and the dashboard's year summary, which is on every plan.
 *
 * <p>Role-gated to PHOTOGRAPHER/ADMIN by {@code SecurityConfig}; the report's
 * plan gate is in its service, so it cannot be skipped by a future caller that
 * reaches the numbers another way.
 *
 * <p>Readable by members as well as the owner. Unlike billing or payouts, a
 * report changes nothing and describes work the whole studio did — hiding last
 * year's booking count from the photographer who shot half of it would be
 * strange, not safe.
 */
@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final YearSummaryService yearSummaryService;

    public AnalyticsController(AnalyticsService analyticsService, YearSummaryService yearSummaryService) {
        this.analyticsService = analyticsService;
        this.yearSummaryService = yearSummaryService;
    }

    /**
     * @param year fiscal year; omitted means the most recent year with data,
     *             which is what the screen opens on
     */
    @GetMapping
    public AnalyticsResponse analytics(@RequestParam(required = false) Integer year) {
        return analyticsService.forYear(year);
    }

    /**
     * Booked, Invoiced and Collected this year, for the dashboard tiles. On
     * every plan: unlike the report, this has no plan gate.
     */
    @GetMapping("/summary")
    public YearSummaryResponse summary() {
        return yearSummaryService.currentYear();
    }
}
