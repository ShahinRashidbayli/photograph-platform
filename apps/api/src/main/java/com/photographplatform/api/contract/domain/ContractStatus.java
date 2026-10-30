package com.photographplatform.api.contract.domain;

/**
 * Where a contract is in its one-way lifecycle.
 *
 * <p>{@code DRAFT → SENT → SIGNED}, with {@code CANCELLED} reachable from the
 * first two. Nothing returns to a previous state: a contract that could go back
 * to DRAFT after being sent would let the text change under a recipient who has
 * already read it, and one that could leave SIGNED would unmake a signature.
 */
public enum ContractStatus {

    /** The photographer is still writing. Editable, invisible to the customer. */
    DRAFT,

    /** Sent to the customer. The text is frozen from here on. */
    SENT,

    /** The customer signed. Terminal. */
    SIGNED,

    /** Withdrawn before signature. Terminal, and kept rather than deleted. */
    CANCELLED
}
