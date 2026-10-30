package com.photographplatform.api.billing.dto;

/** Where to send the browser to complete (or manage) a subscription. */
public record CheckoutSessionResponse(String url) {}
