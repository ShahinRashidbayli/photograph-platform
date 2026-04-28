package com.photographplatform.api.notification.dto;

public record EmailMessage(
    String to,
    String from,
    String subject,
    String htmlBody
) {}
