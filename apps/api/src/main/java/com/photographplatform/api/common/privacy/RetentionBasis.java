package com.photographplatform.api.common.privacy;

/**
 * Why a record survives an erasure request.
 *
 * <p>Art. 17(3) GDPR lists when the right to erasure does not apply. These are
 * the two that reach a photography studio's records; the client shows the
 * photographer which one kept what, because "we kept some of it" is not an
 * answer they can give the person who asked.
 */
public enum RetentionBasis {

    /**
     * Invoices: ten years under §147 AO and §14b UStG — Art. 17(3)(b), a legal
     * obligation. They are also immutable under GoBD, so they are kept as issued.
     */
    TAX_RECORDS,

    /**
     * Signed contracts: the proof of what was agreed, kept for the limitation
     * period — Art. 17(3)(e), the establishment or defence of legal claims.
     */
    LEGAL_CLAIMS
}
