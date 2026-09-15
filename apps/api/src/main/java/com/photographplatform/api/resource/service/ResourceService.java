package com.photographplatform.api.resource.service;

import com.photographplatform.api.common.exception.ConflictException;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.exception.UnauthorizedException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.common.util.Normalize;
import com.photographplatform.api.resource.domain.StudioResource;
import com.photographplatform.api.resource.dto.ResourceRequest;
import com.photographplatform.api.resource.dto.ResourceResponse;
import com.photographplatform.api.resource.repository.StudioResourceRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The studio's rooms and kit.
 *
 * <p>Not plan-gated. Knowing which room a shoot is in is not a Studio feature —
 * a photographer working alone still has one room and one set of lights, and
 * charging for the ability to write that down would be charging for the
 * product's own bookkeeping. What seats made possible is the *conflict*, which
 * only bites when more than one person is booking the same things.
 */
@Service
public class ResourceService {

    private final StudioResourceRepository repository;

    public ResourceService(StudioResourceRepository repository) {
        this.repository = repository;
    }

    /**
     * @param includeRetired the settings screen wants retired resources so they
     *                       can be brought back; the booking form does not,
     *                       because they cannot be assigned to new work
     */
    @Transactional(readOnly = true)
    public List<ResourceResponse> list(boolean includeRetired) {
        List<StudioResource> resources = includeRetired
            ? repository.findAllByOrderByKindAscNameAsc()
            : repository.findByActiveTrueOrderByKindAscNameAsc();
        return resources.stream().map(ResourceService::toResponse).toList();
    }

    /**
     * Writing to the studio's inventory is staff work.
     *
     * <p>The URL rule in {@code SecurityConfig} is the gate that runs in
     * production, and it is in place. This is a second lock on the same door,
     * and it is here because of how BUG-004 happened: the rule lives in one
     * file several prefixes away from the code it protects, and
     * {@code /api/resources} went unruled entirely while this service asked
     * only which tenant the caller belonged to — which a customer of that same
     * tenant satisfies. A service that decides for itself who may write to it
     * cannot be reopened by an editing mistake in a configuration class.
     *
     * <p>Checked before the row is loaded, so a refusal cannot be used to tell
     * an existing resource id from one that was never issued.
     *
     * <p>Reads are deliberately not guarded here: the URL rule covers them,
     * and the damage this is about is on the write path.
     */
    private static void requireStaff() {
        if (!SecurityUtils.currentUserHasRole("PHOTOGRAPHER")
            && !SecurityUtils.currentUserHasRole("ADMIN")) {
            throw new UnauthorizedException("Only studio staff can change resources");
        }
    }

    @Transactional
    public ResourceResponse create(ResourceRequest request) {
        requireStaff();
        StudioResource resource = new StudioResource(
            SecurityUtils.requireCurrentTenantId(),
            request.name().trim(),
            request.kind() == null ? "EQUIPMENT" : request.kind());
        resource.setNotes(Normalize.trimToNull(request.notes()));
        return save(resource);
    }

    @Transactional
    public ResourceResponse update(UUID id, ResourceRequest request) {
        requireStaff();
        StudioResource resource = repository.findById(id)
            .orElseThrow(() -> new NotFoundException("Resource not found"));
        resource.setName(request.name().trim());
        if (request.kind() != null) {
            resource.setKind(request.kind());
        }
        resource.setNotes(Normalize.trimToNull(request.notes()));
        // Absent means "leave it": the edit form sends the whole resource, but
        // the retire/restore control posts on its own.
        if (request.active() != null) {
            resource.setActive(request.active());
        }
        return save(resource);
    }

    private ResourceResponse save(StudioResource resource) {
        try {
            return toResponse(repository.saveAndFlush(resource));
        } catch (DataIntegrityViolationException ex) {
            // uq_studio_resources_name. Two rooms called "Studio A" would make
            // every conflict warning ambiguous about which one is taken.
            throw new ConflictException("You already have something with that name");
        }
    }

    private static ResourceResponse toResponse(StudioResource r) {
        return new ResourceResponse(r.getId(), r.getName(), r.getKind(), r.getNotes(), r.isActive());
    }
}
