package com.photographplatform.api.roadmap.domain;

import java.util.Locale;
import java.util.Optional;

/**
 * The ideas a photographer can register interest in.
 *
 * <p>An enum rather than a free-text key, so the tally cannot be split across
 * "LOCATION_MAP", "location-map" and a typo. The names are the API contract —
 * the frontend sends them back verbatim — and each maps to a row of
 * {@code docs/VISION_AND_EXTENSIBILITY.md} §4.
 *
 * <p>Nothing here is built. That is the whole premise: this enum exists to find
 * out which one should be.
 */
public enum RoadmapFeature {

    /** §4 #1 — experienced photographers sell coaching to newcomers. */
    TRAINING,

    /** §4 #2 — shared scouted locations and angles. The stated differentiator. */
    LOCATION_MAP,

    /** §4 #3 — paid workshops and video lessons. */
    WORKSHOPS,

    /** §4 #4 — equipment and technique guide. No money flow, so the cheapest. */
    GEAR_GUIDE,

    /** §4 #5 — Instagram growth: auto-post, story/reels, strategy. Pro's anchor. */
    INSTAGRAM_GROWTH,

    /** §4 #6 — studios list space, photographers search and book. */
    STUDIO_MARKETPLACE;

    /**
     * Parses a key from the wire, refusing anything unknown.
     *
     * <p>Returns empty rather than throwing so the controller answers 404 for a
     * key that is not an idea, instead of 500 for one that is merely misspelt.
     */
    public static Optional<RoadmapFeature> parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.of(valueOf(raw.trim().toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException notAnIdea) {
            return Optional.empty();
        }
    }
}
