package com.photographplatform.api.booking.domain;

import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The pricing rules, now that they are a type rather than a private method.
 *
 * <p>The point of the value object is that an invalid combination cannot be
 * held at all, so these are constructor tests: there is no path that reaches a
 * booking with a deposit larger than its total, whichever service is doing the
 * writing and whether or not it remembered a check.
 */
class BookingPricingTest {

    @Test
    void anExplicitTotalWinsOverThePackagePrice() {
        UUID packageId = UUID.randomUUID();

        // The photographer is quoting: an extra hour, a discount, a custom job.
        BookingPricing pricing = BookingPricing.resolve(packageId, 180_000, 250_000, null);

        assertThat(pricing.totalCents()).isEqualTo(250_000);
        assertThat(pricing.packageId()).isEqualTo(packageId);
    }

    @Test
    void withoutAnExplicitTotalThePackagePriceApplies() {
        assertThat(BookingPricing.resolve(UUID.randomUUID(), 180_000, null, null).totalCents())
            .isEqualTo(180_000);
    }

    @Test
    void withNeitherAPackageNorAPriceTheBookingIsUnpriced() {
        // A booking can legitimately exist before anyone has quoted it.
        assertThat(BookingPricing.resolve(null, null, null, null).totalCents()).isZero();
        assertThat(BookingPricing.unpriced().totalCents()).isZero();
        assertThat(BookingPricing.unpriced().depositCents()).isZero();
    }

    @Test
    void payingTheWholeThingUpFrontIsANormalDeposit() {
        // The boundary is inclusive — this is not an overpayment.
        assertThat(BookingPricing.resolve(null, null, 100_000, 100_000).depositCents())
            .isEqualTo(100_000);
    }

    @Test
    void aDepositLargerThanTheTotalCannotBeConstructed() {
        // It would be a negative outstanding balance, which the payment state
        // resolver and the invoice totals both read as money owed to the client.
        assertThatThrownBy(() -> new BookingPricing(null, 100_000, 150_000))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Deposit cannot exceed");
    }

    @Test
    void negativeAmountsCannotBeConstructed() {
        // Bean validation refuses these at the API boundary today. The type
        // refuses them for every caller, including ones that never see a DTO.
        assertThatThrownBy(() -> new BookingPricing(null, -1, 0))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new BookingPricing(null, 100, -1))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
