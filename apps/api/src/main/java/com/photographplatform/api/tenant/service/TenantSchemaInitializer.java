package com.photographplatform.api.tenant.service;

import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.Statement;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class TenantSchemaInitializer {

    private static final Logger LOG = LoggerFactory.getLogger(TenantSchemaInitializer.class);

    private final DataSource dataSource;

    /**
     * Inject the raw Hikari pool, not the TenantRoutingDataSource wrapper.
     * Flyway needs a direct connection without any search_path manipulation.
     */
    public TenantSchemaInitializer(HikariDataSource dataSource) {
        this.dataSource = dataSource;
    }

    public void initializeSchema(String tenantId) {
        String schemaName = "tenant_" + tenantId.replace("-", "");

        Flyway.configure()
            .dataSource(dataSource)
            .schemas(schemaName)
            .locations("classpath:db/tenant-migration")
            .baselineOnMigrate(false)
            .load()
            .migrate();
    }

    /**
     * Drops the tenant schema.  Called as a compensating action when registration
     * fails after the schema was already created (DDL cannot be rolled back by
     * Spring's transaction manager, so we clean up manually).
     */
    public void dropSchema(String tenantId) {
        String schemaName = "tenant_" + tenantId.replace("-", "");
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("DROP SCHEMA IF EXISTS \"" + schemaName + "\" CASCADE");
            LOG.warn("Dropped orphaned tenant schema '{}' after failed registration", schemaName);
        } catch (Exception e) {
            LOG.error("Failed to drop orphaned tenant schema '{}'", schemaName, e);
        }
    }
}
