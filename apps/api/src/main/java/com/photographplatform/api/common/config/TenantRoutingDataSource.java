package com.photographplatform.api.common.config;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

public class TenantRoutingDataSource extends AbstractRoutingDataSource {

    /**
     * Cached on first connection acquisition. Schema routing is a Postgres
     * feature; on other engines (H2 in unit tests) we no-op rather than
     * issuing dialect-incompatible DDL.
     */
    private volatile Boolean isPostgres;

    @Override
    protected Object determineCurrentLookupKey() {
        return null; // single physical datasource; schema set via connection
    }

    @Override
    public Connection getConnection() throws SQLException {
        Connection connection = super.getConnection();
        setSearchPath(connection);
        return connection;
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
        Connection connection = super.getConnection(username, password);
        setSearchPath(connection);
        return connection;
    }

    /**
     * Always sets a deterministic search_path on every borrowed connection.
     *
     * <p>Skipping the SET when no tenant is in context would let a connection
     * returned to the Hikari pool keep the previous tenant's search_path —
     * the next request that doesn't set a tenant (login, public endpoints,
     * health checks) would silently inherit it and run queries against the
     * wrong schema.  Resetting to {@code public} closes that leak.
     */
    private void setSearchPath(Connection connection) throws SQLException {
        if (!isPostgres(connection)) {
            return;
        }
        String tenant = TenantContext.getTenant();
        try (var stmt = connection.createStatement()) {
            if (tenant != null && !tenant.isBlank()) {
                String schema = "tenant_" + tenant.replace("-", "");
                stmt.execute("SET search_path TO \"" + schema + "\", public");
            } else {
                stmt.execute("SET search_path TO public");
            }
        }
    }

    private boolean isPostgres(Connection connection) throws SQLException {
        Boolean cached = isPostgres;
        if (cached != null) {
            return cached;
        }
        String product = connection.getMetaData().getDatabaseProductName();
        boolean detected = product != null && product.toLowerCase().contains("postgres");
        isPostgres = detected;
        return detected;
    }

    public static DataSource wrap(DataSource delegate) {
        TenantRoutingDataSource routing = new TenantRoutingDataSource();
        routing.setTargetDataSources(Map.of());
        routing.setDefaultTargetDataSource(delegate);
        routing.afterPropertiesSet();
        return routing;
    }
}
