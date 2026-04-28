package com.photographplatform.api.portfolio.service;

import com.photographplatform.api.common.config.TenantContext;
import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.portfolio.domain.Photo;
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

    public PhotoService(PhotoRepository photoRepository, Optional<R2StorageService> r2StorageService) {
        this.photoRepository = photoRepository;
        this.r2StorageService = r2StorageService;
    }

    @Transactional
    public InitiateUploadResponse initiateUpload(InitiateUploadRequest req, UUID categoryId) {
        String tenantId = TenantContext.getTenant();
        String extension = extractExtension(req.filename());
        String r2Key = tenantId + "/photos/" + UUID.randomUUID() + extension;

        Photo photo = photoRepository.save(new Photo(r2Key, categoryId));

        String uploadUrl = r2StorageService
            .orElseThrow(() -> new IllegalStateException("R2 storage not configured"))
            .generateUploadUrl(r2Key, req.contentType());
        return new InitiateUploadResponse(photo.getId(), r2Key, uploadUrl);
    }

    @Transactional(readOnly = true)
    public List<PhotoResponse> listPublished() {
        return photoRepository.findByIsPublishedTrueOrderBySortOrderAsc()
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<PhotoResponse> listAll() {
        return photoRepository.findAll()
            .stream()
            .sorted((a, b) -> Integer.compare(a.getSortOrder(), b.getSortOrder()))
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public PhotoResponse publish(UUID photoId) {
        Photo photo = photoRepository.findById(photoId)
            .orElseThrow(() -> new NotFoundException(
                "Photo not found: " + photoId));
        photo.setPublished(true);
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

    private String extractExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot >= 0 ? filename.substring(dot) : "";
    }
}
