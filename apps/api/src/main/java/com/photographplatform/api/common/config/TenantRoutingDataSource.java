package com.photographplatform.api.common.config;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.Locale;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;

public class TenantRoutingDataSource extends AbstractRoutingDataSource {

    /**
     * Cached on first connection acquisition. Tenant binding is a Postgres
     * feature; on other engines (H2 in unit tests) we no-op rather than
     * issuing dialect-incompatible SQL.
     */
    private volatile Boolean isPostgres;

    @Override
    protected Object determineCurrentLookupKey() {
        return null; // single physical datasource; tenant bound via GUC per transaction
    }

    @Override
    public Connection getConnection() throws SQLException {
        Connection connection = super.getConnection();
        applyTenantContext(connection);
        return connection;
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
        Connection connection = super.getConnection(username, password);
        applyTenantContext(connection);
        return connection;
    }

    /**
     * Binds the current request's tenant to this connection via a
     * transaction-scoped {@code app.tenant_id} GUC, read by the RLS policies
     * on every tenant-scoped table (see {@code V11__tenant_rls.sql}).
     *
     * <p>This has to be transaction-scoped (SET LOCAL semantics), not a plain
     * session-level {@code SET}. The app is expected to run against Supabase's
     * Supavisor pooler in transaction mode, where a "session" as this
     * connection pool sees it is not reliably pinned to one Postgres backend
     * — the pooler can hand different backends to different transactions
     * issued over the same client connection. A session-level {@code SET}
     * executed here, before Spring's transaction manager has turned off
     * autocommit, would run as its own implicit transaction and could be
     * detached from the real transaction (and its backend) that follows.
     *
     * <p>Disabling autocommit ourselves — before issuing any statement — closes
     * that gap: {@code set_config(..., true)} below and every later statement
     * Spring/Hibernate run on this connection become part of the SAME Postgres
     * transaction, on the same backend, guaranteed. When Spring's
     * DataSourceTransactionManager subsequently calls {@code setAutoCommit(false)}
     * itself it's a no-op (already false). At commit, the LOCAL setting resets
     * automatically, so the next transaction starts clean and this method
     * reruns fresh for it.
     */
    private void applyTenantContext(Connection connection) throws SQLException {
        if (!isPostgres(connection)) {
            return;
        }
        connection.setAutoCommit(false);
        String tenant = TenantContext.getTenant();
        try (PreparedStatement ps =
                 connection.prepareStatement("SELECT set_config('app.tenant_id', ?, true)")) {
            // Blank/absent tenant resolves to '' — the RLS policies NULLIF
            // this back to NULL, so every tenant-scoped query returns zero
            // rows rather than matching on an unset predicate. Fail closed.
            ps.setString(1, tenant != null ? tenant : "");
            ps.execute();
        }
    }

    private boolean isPostgres(Connection connection) throws SQLException {
        Boolean cached = isPostgres;
        if (cached != null) {
            return cached;
        }
        String product = connection.getMetaData().getDatabaseProductName();
        boolean detected = product != null && product.toLowerCase(Locale.ROOT).contains("postgres");
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
