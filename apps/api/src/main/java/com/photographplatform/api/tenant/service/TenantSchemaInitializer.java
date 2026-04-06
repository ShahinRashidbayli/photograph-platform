package com.photographplatform.api.tenant.service;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.stereotype.Service;

@Service
public class TenantSchemaInitializer {

    private final DataSource dataSource;

    public TenantSchemaInitializer(DataSource dataSource) {
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
}
