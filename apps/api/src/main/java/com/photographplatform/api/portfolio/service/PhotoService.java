package com.photographplatform.api.portfolio.service;

import com.photographplatform.api.common.repository.QueryLimits;
import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.media.ImageUploadType;
import com.photographplatform.api.common.media.UploadLimits;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.portfolio.config.R2Properties;
import com.photographplatform.api.portfolio.domain.Photo;
import com.photographplatform.api.portfolio.dto.CompleteUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadRequest;
import com.photographplatform.api.portfolio.dto.InitiateUploadResponse;
import com.photographplatform.api.portfolio.dto.PhotoResponse;
import com.photographplatform.api.portfolio.repository.PhotoRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PhotoService {

    private final PhotoRepository photoRepository;
    private final Optional<R2StorageService> r2StorageService;
    private final ThumbnailService thumbnailService;
    private final R2Properties r2Properties;

    public PhotoService(PhotoRepository photoRepository,
                        Optional<R2StorageService> r2StorageService,
                        ThumbnailService thumbnailService,
                        R2Properties r2Properties) {
        this.photoRepository = photoRepository;
        this.r2StorageService = r2StorageService;
        this.thumbnailService = thumbnailService;
        this.r2Properties = r2Properties;
    }

    /**
     * Mints a pre-signed PUT for one portfolio photo.
     *
     * <p>Both the type and the size are settled here, because this is the last
     * moment either can be. What this method returns is a capability to write
     * an object; after that the browser talks to R2 directly and the only terms
     * that still apply are the ones baked into the signature.
     */
    @Transactional
    public InitiateUploadResponse initiateUpload(InitiateUploadRequest req, UUID categoryId) {
        ImageUploadType type = ImageUploadType.resolve(req.contentType(), req.filename());
        long sizeBytes = UploadLimits.requireWithin(
            req.fileSizeBytes(), r2Properties.getMaxUploadBytes(), "Photo");

        String tenantId = TenantContext.getTenant();
        String r2Key = tenantId + "/photos/" + UUID.randomUUID() + type.extension();

        Photo photo = new Photo(r2Key, categoryId);
        photo.setTenantId(SecurityUtils.requireCurrentTenantId());
        // Recorded now rather than at complete-time. The URL below is signed for
        // exactly this many bytes, so this is the size the object can have —
        // whereas the figure the client used to send afterwards was just a
        // claim, and storage totals built on it could be understated at will.
        photo.setFileSizeBytes(sizeBytes);
        photo = photoRepository.save(photo);

        String uploadUrl = r2StorageService
            .orElseThrow(() -> new IllegalStateException("R2 storage not configured"))
            .generateUploadUrl(r2Key, type.contentType(), sizeBytes);
        return new InitiateUploadResponse(photo.getId(), r2Key, uploadUrl, type.contentType());
    }

    @Transactional(readOnly = true)
    public List<PhotoResponse> listPublished() {
        return photoRepository.findByIsPublishedTrueOrderBySortOrderAsc(QueryLimits.LIST)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<PhotoResponse> listAll() {
        return photoRepository.findAllByOrderBySortOrderAsc(QueryLimits.LIST)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    /**
     * Marks an upload finished and triggers thumbnail generation. Idempotent —
     * re-calls overwrite the metadata and re-trigger the thumbnail. Width/height
     * from the client are best-effort hints; the thumbnail job re-extracts them
     * authoritatively when it decodes the image.
     *
     * <p>The file size is deliberately <em>not</em> taken from here. It was,
     * and that made every storage figure self-reported: the client could upload
     * one thing and declare another, with nothing able to contradict it. It is
     * now fixed at initiate-time, where it is signed into the upload URL.
     */
    @Transactional
    public PhotoResponse completeUpload(UUID photoId, CompleteUploadRequest req) {
        Photo photo = photoRepository.findById(photoId)
            .orElseThrow(() -> new NotFoundException("Photo not found: " + photoId));

        if (req.width() != null) {
            photo.setWidth(req.width());
        }
        if (req.height() != null) {
            photo.setHeight(req.height());
        }

        Photo saved = photoRepository.save(photo);

        // Tenant must be captured for the @Async hand-off because the request
        // thread's TenantContext clears as soon as this method returns.
        String tenantId = TenantContext.getTenant();
        thumbnailService.generateThumbnail(saved.getId(), tenantId);

        return toResponse(saved);
    }

    @Transactional
    public PhotoResponse publish(UUID photoId) {
        Photo photo = photoRepository.findById(photoId)
            .orElseThrow(() -> new NotFoundException(
                "Photo not found: " + photoId));
        photo.setPublished(true);
        return toResponse(photoRepository.save(photo));
    }

    /** Return a published photo to draft, removing it from the public page. */
    @Transactional
    public PhotoResponse unpublish(UUID photoId) {
        Photo photo = photoRepository.findById(photoId)
            .orElseThrow(() -> new NotFoundException("Photo not found: " + photoId));
        photo.setPublished(false);
        return toResponse(photoRepository.save(photo));
    }

    /** Assign (or clear, when {@code categoryId} is null) a photo's category. */
    @Transactional
    public PhotoResponse setCategory(UUID photoId, UUID categoryId) {
        Photo photo = photoRepository.findById(photoId)
            .orElseThrow(() -> new NotFoundException("Photo not found: " + photoId));
        photo.setCategoryId(categoryId);
        return toResponse(photoRepository.save(photo));
    }

    @Transactional
    public void delete(UUID photoId) {
        photoRepository.deleteById(photoId);
    }

    private PhotoResponse toResponse(Photo photo) {
        R2StorageService storage = r2StorageService
            .orElseThrow(() -> new IllegalStateException("R2 storage not configured"));
        String viewUrl = storage.generateDownloadUrl(photo.getR2Key());
        String thumbnailUrl = photo.getThumbnailKey() != null
            ? storage.generateDownloadUrl(photo.getThumbnailKey())
            : viewUrl;
        return new PhotoResponse(
            photo.getId(),
            photo.getCategoryId(),
            viewUrl,
            thumbnailUrl,
            photo.getFileSizeBytes(),
            photo.getWidth(),
            photo.getHeight(),
            photo.getSortOrder(),
            photo.isPublished(),
            photo.getCreatedAt()
        );
    }

}
