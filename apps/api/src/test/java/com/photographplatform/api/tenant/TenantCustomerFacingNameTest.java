package com.photographplatform.api.tenant;

import com.photographplatform.api.tenant.domain.Tenant;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** The one answer to "what does a Customer call this studio?" (#103). */
class TenantCustomerFacingNameTest {

    private static Tenant studio(String businessName, String legalName) {
        Tenant tenant = new Tenant("qa-pipe-11251358", "anna@example.test");
        tenant.setBusinessName(businessName);
        tenant.setLegalName(legalName);
        return tenant;
    }

    @Test
    void theBusinessNameComesFirst() {
        assertThat(studio("Studio Lichtblick", "Anna Müller").customerFacingName()).isEqualTo("Studio Lichtblick");
    }

    @Test
    void theLegalNameStandsInWhenThereIsNoBusinessName() {
        assertThat(studio("  ", " Anna Müller ").customerFacingName()).isEqualTo("Anna Müller");
    }

    @Test
    void withNeitherThereIsNoNameAndNeverTheSubdomain() {
        assertThat(studio(null, null).customerFacingName()).isNull();
    }
}
