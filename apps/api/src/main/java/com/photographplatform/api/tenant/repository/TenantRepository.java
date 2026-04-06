package com.photographplatform.api.tenant.repository;

import com.photographplatform.api.tenant.domain.Tenant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    boolean existsBySubdomain(String subdomain);
    Optional<Tenant> findBySubdomain(String subdomain);
}
