package com.photographplatform.api.auth.domain;

/**
 * A staff account's standing inside its own studio.
 *
 * <p>Distinct from {@code User.role}, which answers a different question:
 * that one decides how the account authenticates and which API surface it may
 * reach, and treats PHOTOGRAPHER and ADMIN as the same thing everywhere
 * ({@code hasAnyRole("PHOTOGRAPHER","ADMIN")}). Two accounts can be identical
 * to Spring Security and still differ on whether one of them may cancel the
 * subscription — that is what this answers.
 *
 * <p>Null for customers. The database states both halves of that as one
 * constraint ({@code chk_users_staff_role}, V25) so the two cannot drift.
 */
public enum StaffRole {

    /**
     * The photographer who created the studio, and the only account that may
     * change the plan, manage billing, or invite and remove colleagues.
     *
     * <p>Exactly one per tenant, enforced by {@code uq_users_tenant_owner}.
     * Two owners is not a lesser problem than none: it is two accounts that
     * can each lock the other out.
     */
    OWNER,

    /**
     * A photographer who was invited into someone else's studio. Does the
     * work — bookings, galleries, leads, clients — but does not decide what
     * the studio pays for or who else is in it.
     */
    MEMBER;

    public boolean isOwner() {
        return this == OWNER;
    }
}
