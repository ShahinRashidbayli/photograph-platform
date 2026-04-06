package com.photographplatform.api.common.config;

import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

public class TenantRoutingDataSource extends AbstractRoutingDataSource {

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

    private void setSearchPath(Connection connection) throws SQLException {
        String tenant = TenantContext.getTenant();
        if (tenant != null) {
            String schema = "tenant_" + tenant.replace("-", "");
            try (var stmt = connection.createStatement()) {
                stmt.execute("SET search_path TO \"" + schema + "\", public");
            }
        }
    }

    public static DataSource wrap(DataSource delegate) {
        TenantRoutingDataSource routing = new TenantRoutingDataSource();
        routing.setDefaultTargetDataSource(delegate);
        routing.afterPropertiesSet();
        return routing;
    }
}
