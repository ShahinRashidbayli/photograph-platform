package com.photographplatform.api.common.util;

import java.time.ZoneId;

/**
 * The timezone the business itself runs in.
 *
 * <p>Extracted from {@code InvoiceDate}, which discovered the hard way that
 * "now" has to be pinned to one zone: an invoice issued at 00:43 printed one
 * date on the PDF and posted a different Belegdatum to DATEV, because two
 * pieces of code converted the same instant in two offsets.
 *
 * <p>The same reasoning reaches past invoices. A gallery's 60-day retention
 * and a trial's 14 days are both counted in days a customer will read off a
 * calendar, and a scheduled job that runs "daily" has to mean a German day —
 * otherwise the reminder a client is promised on day 45 lands on day 44 or 46
 * depending on where the container happens to run.
 */
public final class BusinessZone {

    /** Europe/Berlin — handles CET/CEST, which a fixed +01:00 would not. */
    public static final ZoneId ID = ZoneId.of("Europe/Berlin");

    private BusinessZone() {
    }
}
