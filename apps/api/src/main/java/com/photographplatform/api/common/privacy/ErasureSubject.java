package com.photographplatform.api.common.privacy;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * The person being erased, as every module knows them.
 *
 * <p>Starts as an email within one studio and gains keys during the identify
 * pass of {@link PersonalDataEraser}: the customer account, the client
 * directory entries, the bookings. The email is held normalised — trimmed and
 * lower-cased, the form every table stores — so implementations compare
 * against it directly.
 */
public final class ErasureSubject {

    private final UUID tenantId;
    private final String email;
    private UUID customerUserId;
    private final Set<UUID> clientIds = new LinkedHashSet<>();
    private final Set<UUID> bookingIds = new LinkedHashSet<>();

    public ErasureSubject(UUID tenantId, String normalizedEmail) {
        this.tenantId = Objects.requireNonNull(tenantId, "tenantId");
        this.email = Objects.requireNonNull(normalizedEmail, "email");
    }

    public UUID tenantId() {
        return tenantId;
    }

    public String email() {
        return email;
    }

    /** The subject's customer account in this studio, or null if they never signed in. */
    public UUID customerUserId() {
        return customerUserId;
    }

    public void customerUserId(UUID id) {
        this.customerUserId = id;
    }

    public Set<UUID> clientIds() {
        return Collections.unmodifiableSet(clientIds);
    }

    public void addClientIds(Set<UUID> ids) {
        clientIds.addAll(ids);
    }

    public Set<UUID> bookingIds() {
        return Collections.unmodifiableSet(bookingIds);
    }

    public void addBookingIds(Set<UUID> ids) {
        bookingIds.addAll(ids);
    }
}
