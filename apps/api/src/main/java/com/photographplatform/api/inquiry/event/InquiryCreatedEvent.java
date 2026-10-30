package com.photographplatform.api.inquiry.event;

import java.time.LocalDate;
import java.util.UUID;
import org.springframework.context.ApplicationEvent;

/**
 * Published when an authenticated customer submits an inquiry. Mirrors
 * {@code LeadCreatedEvent} so notification listeners stay symmetric across the
 * two intake paths (anonymous lead form vs. signed-in customer request).
 *
 * <p>Carries the photographer's email rather than a tenant id because the
 * listener is {@code @Async}: by the time it runs, the request thread's
 * {@code TenantContext} is already cleared, so a tenant-scoped lookup would
 * fail. Everything the email needs is on the event.
 */
public class InquiryCreatedEvent extends ApplicationEvent {

    private final UUID inquiryId;
    private final String customerName;
    private final String customerEmail;
    private final String eventType;
    private final String budgetRange;
    private final LocalDate proposedDate;
    private final String location;
    private final String score;
    private final String photographerEmail;

    @SuppressWarnings("checkstyle:ParameterNumber")
    public InquiryCreatedEvent(Object source, UUID inquiryId, String customerName,
                               String customerEmail, String eventType, String budgetRange,
                               LocalDate proposedDate, String location, String score,
                               String photographerEmail) {
        super(source);
        this.inquiryId = inquiryId;
        this.customerName = customerName;
        this.customerEmail = customerEmail;
        this.eventType = eventType;
        this.budgetRange = budgetRange;
        this.proposedDate = proposedDate;
        this.location = location;
        this.score = score;
        this.photographerEmail = photographerEmail;
    }

    public UUID getInquiryId() {
        return inquiryId;
    }

    public String getCustomerName() {
        return customerName;
    }

    public String getCustomerEmail() {
        return customerEmail;
    }

    public String getEventType() {
        return eventType;
    }

    public String getBudgetRange() {
        return budgetRange;
    }

    public LocalDate getProposedDate() {
        return proposedDate;
    }

    public String getLocation() {
        return location;
    }

    public String getScore() {
        return score;
    }

    public String getPhotographerEmail() {
        return photographerEmail;
    }
}
