package com.photographplatform.api.privacy.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Whose data to erase. In the body rather than the URL so the address never
 * lands in an access log — the one place erasure could not reach afterwards.
 */
public record ErasureRequest(@NotBlank @Email @Size(max = 320) String email) {
}
