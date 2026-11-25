package com.photographplatform.api.lead.event;

import java.util.UUID;
import org.springframework.context.ApplicationEvent;

public class LeadCreatedEvent extends ApplicationEvent {

    private final UUID leadId;
    private final UUID tenantId;
    private final String clientName;
    private final String clientEmail;
    private final String score;
    private final String photographerSubdomain;
    private final String photographerEmail;

    public LeadCreatedEvent(Object source, UUID leadId, UUID tenantId, String clientName, String clientEmail,
                            String score, String photographerSubdomain, String photographerEmail) {
        super(source);
        this.leadId = leadId;
        this.tenantId = tenantId;
        this.clientName = clientName;
        this.clientEmail = clientEmail;
        this.score = score;
        this.photographerSubdomain = photographerSubdomain;
        this.photographerEmail = photographerEmail;
    }

    public UUID getLeadId() {
        return leadId;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public String getClientName() {
        return clientName;
    }

    public String getClientEmail() {
        return clientEmail;
    }

    public String getScore() {
        return score;
    }

    public String getPhotographerSubdomain() {
        return photographerSubdomain;
    }

    public String getPhotographerEmail() {
        return photographerEmail;
    }
}
