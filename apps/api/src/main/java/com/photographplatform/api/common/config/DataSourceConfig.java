package com.photographplatform.api.common.config;

import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class DataSourceConfig {

    /**
     * The raw HikariCP pool, wrapped below before it's exposed as the
     * primary {@link DataSource}.
     */
    @Bean
    @ConfigurationProperties("spring.datasource.hikari")
    public HikariDataSource hikariDataSource(DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder()
            .type(HikariDataSource.class)
            .build();
    }

    /**
     * Wrap the Hikari pool in TenantRoutingDataSource so that every
     * connection borrowed by JPA/Hibernate has the current request's tenant
     * bound as a transaction-scoped {@code app.tenant_id} GUC before any
     * query runs — see {@link TenantRoutingDataSource} for why this has to
     * be transaction-scoped rather than a plain session-level {@code SET}.
     */
    @Bean
    @Primary
    public DataSource dataSource(HikariDataSource hikariDataSource) {
        return TenantRoutingDataSource.wrap(hikariDataSource);
    }
}
