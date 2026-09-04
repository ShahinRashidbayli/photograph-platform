package com.photographplatform.api.tenant.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

/**
 * The photographer editing their own Impressum details from Settings.
 *
 * <p>Deliberately permissive: fields are not {@code @NotBlank} because the form
 * is saved incrementally and a Kleinunternehmer (§19 UStG) legitimately has
 * neither a VAT id nor a register entry. Whether the mandatory set is complete
 * is answered by {@code TenantLegalService.isComplete} and surfaced to the UI,
 * rather than blocking the save — a half-filled draft the photographer can come
 * back to beats a form that refuses to save.
 *
 * <p>Length caps mirror the column widths so an over-long value fails as a 400
 * with a field name rather than a database constraint violation.
 */
public record UpdateTenantLegalRequest(
    @Size(max = 200) String legalName,
    @Size(max = 200) String legalStreet,
    @Size(max = 20) String legalPostalCode,
    @Size(max = 120) String legalCity,
    @Size(max = 80) String legalCountry,
    @Email @Size(max = 320) String legalEmail,
    @Size(max = 50) String legalPhone,
    @Size(max = 50) String legalVatId,
    @Size(max = 200) String legalRegister,
    @Size(max = 200) String legalResponsible,
    @Email @Size(max = 320) String privacyContactEmail
) {}
