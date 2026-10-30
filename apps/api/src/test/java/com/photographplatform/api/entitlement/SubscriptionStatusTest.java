package com.photographplatform.api.entitlement;

import com.photographplatform.api.tenant.domain.Plan;
import com.photographplatform.api.tenant.domain.SubscriptionStatus;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The two enums that decide, between them, what a tenant is entitled to. Both
 * translate an outside string into an access decision, so both are tested for
 * what they do with a string they do not recognise — which is the case that
 * actually shows up in production.
 */
class SubscriptionStatusTest {

    @Test
    void mapsStripesVocabularyToOurs() {
        assertThat(SubscriptionStatus.fromStripe("active")).isEqualTo(SubscriptionStatus.ACTIVE);
        assertThat(SubscriptionStatus.fromStripe("trialing")).isEqualTo(SubscriptionStatus.TRIALING);
        assertThat(SubscriptionStatus.fromStripe("past_due")).isEqualTo(SubscriptionStatus.PAST_DUE);
        assertThat(SubscriptionStatus.fromStripe("canceled")).isEqualTo(SubscriptionStatus.CANCELED);
        assertThat(SubscriptionStatus.fromStripe("unpaid")).isEqualTo(SubscriptionStatus.UNPAID);
    }

    @Test
    void bothIncompleteFlavoursCollapseToIncomplete() {
        assertThat(SubscriptionStatus.fromStripe("incomplete")).isEqualTo(SubscriptionStatus.INCOMPLETE);
        assertThat(SubscriptionStatus.fromStripe("incomplete_expired"))
            .isEqualTo(SubscriptionStatus.INCOMPLETE);
    }

    /**
     * A status Stripe adds in a future API version must degrade to the least
     * entitled state. Mapping it optimistically — or blindly {@code valueOf}-ing
     * it — would let a provider change silently widen access.
     */
    @Test
    void anUnrecognisedStripeStatusIsTreatedAsUnsubscribed() {
        assertThat(SubscriptionStatus.fromStripe("paused")).isEqualTo(SubscriptionStatus.NONE);
        assertThat(SubscriptionStatus.fromStripe(null)).isEqualTo(SubscriptionStatus.NONE);
        assertThat(SubscriptionStatus.fromStripe("")).isEqualTo(SubscriptionStatus.NONE);
        assertThat(SubscriptionStatus.fromStripe("paused").grantsAccess()).isFalse();
    }

    @Test
    void onlyActiveAndPastDueGrantAccess() {
        assertThat(SubscriptionStatus.ACTIVE.grantsAccess()).isTrue();
        assertThat(SubscriptionStatus.PAST_DUE.grantsAccess()).isTrue();

        assertThat(SubscriptionStatus.TRIALING.grantsAccess()).isFalse();
        assertThat(SubscriptionStatus.NONE.grantsAccess()).isFalse();
        assertThat(SubscriptionStatus.CANCELED.grantsAccess()).isFalse();
        assertThat(SubscriptionStatus.UNPAID.grantsAccess()).isFalse();
        assertThat(SubscriptionStatus.INCOMPLETE.grantsAccess()).isFalse();
    }

    /**
     * TRIALING deliberately does not grant access on its own — the trial's
     * deadline does. Folding "trialing" into grantsAccess() would make an
     * expired trial writable forever, since Stripe leaves the status alone
     * until its own trial ends.
     */
    @Test
    void trialingIsDecidedByTheDeadlineNotTheStatus() {
        assertThat(SubscriptionStatus.TRIALING.grantsAccess()).isFalse();
    }

    @Test
    void storedColumnValuesRoundTrip() {
        for (SubscriptionStatus status : SubscriptionStatus.values()) {
            assertThat(SubscriptionStatus.from(status.name())).isEqualTo(status);
        }
        assertThat(SubscriptionStatus.from("garbage")).isEqualTo(SubscriptionStatus.NONE);
        assertThat(SubscriptionStatus.from(null)).isEqualTo(SubscriptionStatus.NONE);
    }

    @Test
    void planParsingIsForgivingButNeverGenerous() {
        assertThat(Plan.from(" pro ")).isEqualTo(Plan.PRO);
        assertThat(Plan.from("Studio")).isEqualTo(Plan.STUDIO);
        assertThat(Plan.from("ENTERPRISE")).isEqualTo(Plan.STARTER);
        assertThat(Plan.from(null)).isEqualTo(Plan.STARTER);
    }

    @Test
    void planOrderingReflectsTierInclusion() {
        assertThat(Plan.STUDIO.atLeast(Plan.PRO)).isTrue();
        assertThat(Plan.PRO.atLeast(Plan.PRO)).isTrue();
        assertThat(Plan.STARTER.atLeast(Plan.PRO)).isFalse();
    }
}
