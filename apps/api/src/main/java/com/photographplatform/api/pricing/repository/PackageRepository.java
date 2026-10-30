package com.photographplatform.api.pricing.repository;

import com.photographplatform.api.pricing.domain.Package;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PackageRepository extends JpaRepository<Package, UUID> {

    List<Package> findAllByOrderBySortOrderAscNameAsc();

    List<Package> findByActiveTrueOrderBySortOrderAscNameAsc();
}
