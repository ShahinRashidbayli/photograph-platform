package com.photographplatform.api.auth.service;

import java.util.Set;

/**
 * Subdomains reserved for platform infrastructure or that would be confusing
 * if a tenant claimed them. Lookup is case-insensitive.
 */
final class ReservedSubdomains {

    private static final Set<String> RESERVED = Set.of(
        // Platform / infra
        "api", "www", "app", "admin", "dashboard", "fotolio",
        "auth", "login", "signup", "register", "logout", "account",
        "billing", "payments", "stripe", "webhook", "webhooks",
        "static", "cdn", "media", "assets", "images", "files",
        // Mail / DNS
        "mail", "email", "smtp", "imap", "pop", "pop3", "ns1", "ns2", "mx", "ftp",
        // Standard
        "blog", "docs", "help", "support", "status", "internal",
        // Environments
        "test", "tests", "staging", "stage", "dev", "develop", "prod", "production",
        // Brand-adjacent
        "fotograf", "fotograf-platform", "photograph", "photographs"
    );

    private ReservedSubdomains() {
    }

    static boolean isReserved(String subdomain) {
        return subdomain != null && RESERVED.contains(subdomain.toLowerCase());
    }
}
