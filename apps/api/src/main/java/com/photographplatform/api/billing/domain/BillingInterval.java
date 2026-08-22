package com.photographplatform.api.billing.domain;

import java.util.Locale;

/**
 * How often the photographer is billed. The landing page sells both, with the
 * yearly price framed as "−2 Monate".
 */
public enum BillingInterval {

    MONTHLY,
    YEARLY;

    public static BillingInterval from(String raw) {
        if (raw == null) {
            return MONTHLY;
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException unknown) {
            // Monthly is the smaller commitment, so an unreadable value must
            // never silently charge someone for a year.
            return MONTHLY;
        }
    }
}
