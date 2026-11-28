package com.photographplatform.api.inquiry.event;

import com.photographplatform.api.common.domain.CustomerLanguage;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.context.ApplicationEvent;

/**
 * Published when an authenticated customer submits an inquiry. Mirrors
 * {@code LeadCreatedEvent} so notification listeners stay symmetric across the
 * two intake paths (anonymous lead form vs. signed-in customer request).
 *
 * <p>Everything the email needs is on the event, so the listener queues it
 * without a lookup. The tenant travels too: the queued job carries it
 * (ADR-005), and a failed send names the studio it concerns.
 */
public class InquiryCreatedEvent extends ApplicationEvent {

    private final UUID inquiryId;
    private final UUID tenantId;
    private final String customerName;
    private final String customerEmail;
    private final String eventType;
    private final String budgetRange;
    private final LocalDate proposedDate;
    private final String location;
    private final String score;
    private final String photographerEmail;
    private final CustomerLanguage photographerLanguage;

    @SuppressWarnings("checkstyle:ParameterNumber")
    public InquiryCreatedEvent(Object source, UUID inquiryId, UUID tenantId, String customerName,
                               String customerEmail, String eventType, String budgetRange,
                               LocalDate proposedDate, String location, String score,
                               String photographerEmail, CustomerLanguage photographerLanguage) {
        super(source);
        this.inquiryId = inquiryId;
        this.tenantId = tenantId;
        this.customerName = customerName;
        this.customerEmail = customerEmail;
        this.eventType = eventType;
        this.budgetRange = budgetRange;
        this.proposedDate = proposedDate;
        this.location = location;
        this.score = score;
        this.photographerEmail = photographerEmail;
        this.photographerLanguage = photographerLanguage;
    }

    public UUID getInquiryId() {
        return inquiryId;
    }

    public UUID getTenantId() {
        return tenantId;
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

    /** The language of whoever {@link #getPhotographerEmail()} is: the Notification is written in it. */
    public CustomerLanguage getPhotographerLanguage() {
        return photographerLanguage;
    }
}
