package com.photographplatform.api.resource.controller;

import com.photographplatform.api.resource.dto.ResourceRequest;
import com.photographplatform.api.resource.dto.ResourceResponse;
import com.photographplatform.api.resource.service.ResourceService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The studio's rooms and kit. Role-gated to PHOTOGRAPHER/ADMIN by
 * {@code SecurityConfig}, and open to members as well as the owner: a
 * photographer needs to say which room they are using, and asking the owner to
 * do it for them is not a permission model, it is an obstacle.
 */
@RestController
@RequestMapping("/api/resources")
public class ResourceController {

    private final ResourceService resourceService;

    public ResourceController(ResourceService resourceService) {
        this.resourceService = resourceService;
    }

    @GetMapping
    public List<ResourceResponse> list(
        @RequestParam(defaultValue = "false") boolean includeRetired) {
        return resourceService.list(includeRetired);
    }

    @PostMapping
    public ResponseEntity<ResourceResponse> create(@Valid @RequestBody ResourceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(resourceService.create(request));
    }

    /** Also how a resource is retired and brought back — see {@code active}. */
    @PutMapping("/{id}")
    public ResourceResponse update(
        @PathVariable UUID id, @Valid @RequestBody ResourceRequest request) {
        return resourceService.update(id, request);
    }
}
