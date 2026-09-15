package com.photographplatform.api.roadmap.controller;

import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.roadmap.domain.RoadmapFeature;
import com.photographplatform.api.roadmap.service.FeatureInterestService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * "I would use this" for ideas that do not exist yet.
 *
 * <p>Gated to PHOTOGRAPHER/ADMIN in {@code SecurityConfig} alongside the other
 * tenant-wide surfaces: the answer belongs to the studio, not to a client who
 * happens to share its tenant.
 */
@RestController
@RequestMapping("/api/roadmap/interest")
public class RoadmapController {

    private final FeatureInterestService interestService;

    public RoadmapController(FeatureInterestService interestService) {
        this.interestService = interestService;
    }

    /** The keys this studio has asked for. The UI renders a toggle per idea. */
    @GetMapping
    public ResponseEntity<List<String>> listOwn() {
        return ResponseEntity.ok(interestService.listForCurrentTenant());
    }

    @PutMapping("/{feature}")
    public ResponseEntity<Void> register(@PathVariable String feature) {
        interestService.register(parse(feature));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{feature}")
    public ResponseEntity<Void> withdraw(@PathVariable String feature) {
        interestService.withdraw(parse(feature));
        return ResponseEntity.noContent().build();
    }

    /**
     * 404 for a key that is not one of the ideas — the same answer as any other
     * unknown path, rather than 422, because the key is part of the URL and a
     * caller asking for an idea that does not exist has not sent bad input so
     * much as asked for the wrong thing.
     */
    private static RoadmapFeature parse(String raw) {
        return RoadmapFeature.parse(raw)
            .orElseThrow(() -> new NotFoundException("No such roadmap idea: " + raw));
    }
}
