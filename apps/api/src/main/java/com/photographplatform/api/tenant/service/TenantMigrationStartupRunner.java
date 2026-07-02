package com.photographplatform.api.tenant.service;

import com.photographplatform.api.tenant.repository.TenantRepository;
import com.photographplatform.api.tenant.domain.Tenant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Catches every existing tenant up to the latest tenant-migration version on
 * application startup.
 *
 * <p>Without this, new migrations only land for tenants registered *after*
 * the migration file was added — the existing pattern of running Flyway on
 * tenant registration (see {@link TenantSchemaInitializer}) doesn't touch
 * already-registered tenants. The first migration to expose the gap was V5
 * (lead.internal_notes); the entity referenced a column that didn't exist
 * in any pre-existing tenant's leads table.
 *
 * <p>Flyway is idempotent: running {@code migrate()} against a schema where
 * V1 and V2 have already been applied skips them and applies V3+ in order.
 * Safe to re-run; logs progress for each tenant so a failure can be tied to
 * a specific schema without grepping stack traces.
 */
@Component
public class TenantMigrationStartupRunner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(TenantMigrationStartupRunner.class);

    private final TenantRepository tenantRepository;
    private final TenantSchemaInitializer schemaInitializer;

    public TenantMigrationStartupRunner(
        TenantRepository tenantRepository,
        TenantSchemaInitializer schemaInitializer
    ) {
        this.tenantRepository = tenantRepository;
        this.schemaInitializer = schemaInitializer;
    }

    @Override
    public void run(ApplicationArguments args) {
        // Wrapped because the test context loads against H2 with no tenants
        // table; we don't want a startup runner to fail the context. A real
        // dev/prod environment has a populated tenants table — listing returns
        // an empty list only on a brand-new install (no registrations yet).
        List<Tenant> tenants;
        try {
            tenants = tenantRepository.findAll();
        } catch (RuntimeException ex) {
            LOG.warn(
                "Skipping per-tenant migration sweep — could not list tenants: {}",
                ex.getMessage()
            );
            return;
        }
        if (tenants.isEmpty()) {
            LOG.info("No existing tenants — skipping per-tenant migration sweep.");
            return;
        }
        LOG.info("Running tenant-migration sweep across {} tenant(s)…", tenants.size());
        int ok = 0;
        int failed = 0;
        for (Tenant tenant : tenants) {
            try {
                schemaInitializer.initializeSchema(tenant.getId().toString());
                ok++;
            } catch (RuntimeException ex) {
                failed++;
                // Log + continue: one broken schema shouldn't block startup
                // for the rest. The thrown migration will surface on the
                // next request against that tenant anyway.
                LOG.error(
                    "Migration sweep failed for tenant {} (subdomain={}): {}",
                    tenant.getId(), tenant.getSubdomain(), ex.getMessage()
                );
            }
        }
        LOG.info("Tenant-migration sweep done: {} OK, {} failed.", ok, failed);
    }
}
