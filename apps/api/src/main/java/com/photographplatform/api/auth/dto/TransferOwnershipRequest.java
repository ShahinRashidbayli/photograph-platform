package com.photographplatform.api.auth.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** Which colleague becomes the studio's owner. See {@code TeamController}. */
public record TransferOwnershipRequest(@NotNull UUID memberId) {
}
