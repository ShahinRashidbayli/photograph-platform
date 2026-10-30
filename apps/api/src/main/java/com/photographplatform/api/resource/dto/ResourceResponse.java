package com.photographplatform.api.resource.dto;

import java.util.UUID;

/** One room or piece of kit, as the settings screen and booking form see it. */
public record ResourceResponse(UUID id, String name, String kind, String notes, boolean active) {
}
