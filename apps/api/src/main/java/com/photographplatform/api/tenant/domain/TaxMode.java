package com.photographplatform.api.tenant.domain;

/**
 * A tenant's German sales-tax regime, snapshotted onto every invoice it
 * issues (see {@code Invoice.taxMode}) so a later regime change never
 * rewrites the tax treatment of a past invoice.
 */
public enum TaxMode {
    /** §19 UStG — no VAT is charged; the invoice must carry a mandatory notice instead. */
    KLEINUNTERNEHMER,
    /** Standard VAT liability — 19%/7% is charged per line item. */
    REGELBESTEUERUNG
}
