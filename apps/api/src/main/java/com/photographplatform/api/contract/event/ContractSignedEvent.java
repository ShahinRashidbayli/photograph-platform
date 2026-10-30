package com.photographplatform.api.contract.event;

import java.util.UUID;
import org.springframework.context.ApplicationEvent;

/**
 * A customer signed their contract.
 *
 * <p>Published rather than calling the notification service directly, per
 * BACKEND_FOUNDATION's event rule: the contract module's job ends when the
 * signature is stored, and who needs telling about it is not its business.
 * Today one listener emails the photographer; a future one might file the PDF
 * or advance the booking, and neither should require editing this module.
 *
 * <p>Carries everything a listener needs, so no listener has to load the
 * contract back out of the database — and so the event stays readable on its
 * own when it turns up in a log.
 */
public class ContractSignedEvent extends ApplicationEvent {

    private final UUID contractId;
    private final UUID tenantId;
    private final UUID bookingId;
    private final String title;
    private final String signerName;
    private final String photographerEmail;

    public ContractSignedEvent(Object source, UUID contractId, UUID tenantId, UUID bookingId,
                               String title, String signerName, String photographerEmail) {
        super(source);
        this.contractId = contractId;
        this.tenantId = tenantId;
        this.bookingId = bookingId;
        this.title = title;
        this.signerName = signerName;
        this.photographerEmail = photographerEmail;
    }

    public UUID getContractId() {
        return contractId;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public UUID getBookingId() {
        return bookingId;
    }

    public String getTitle() {
        return title;
    }

    public String getSignerName() {
        return signerName;
    }

    public String getPhotographerEmail() {
        return photographerEmail;
    }
}
