package com.photographplatform.api.invoice.domain;

import java.math.BigDecimal;

/** Per-line tax treatment under {@code REGELBESTEUERUNG}; irrelevant (always 0%) under {@code KLEINUNTERNEHMER}. */
public enum TaxCategory {
    STANDARD(new BigDecimal("19.00")),
    REDUCED(new BigDecimal("7.00")),
    EXEMPT(BigDecimal.ZERO);

    private final BigDecimal ratePercent;

    TaxCategory(BigDecimal ratePercent) {
        this.ratePercent = ratePercent;
    }

    public BigDecimal ratePercent() {
        return ratePercent;
    }
}
