package com.photographplatform.api.common;

import com.photographplatform.api.common.config.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TenantContextTest {

    @AfterEach
    void cleanup() {
        TenantContext.clear();
    }

    @Test
    void setAndGet() {
        TenantContext.setTenant("abc123");
        assertThat(TenantContext.getTenant()).isEqualTo("abc123");
    }

    @Test
    void clearReturnsNull() {
        TenantContext.setTenant("abc123");
        TenantContext.clear();
        assertThat(TenantContext.getTenant()).isNull();
    }

    @Test
    void defaultIsNull() {
        assertThat(TenantContext.getTenant()).isNull();
    }
}
