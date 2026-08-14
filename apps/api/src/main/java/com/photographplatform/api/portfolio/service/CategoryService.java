package com.photographplatform.api.portfolio.service;

import com.photographplatform.api.common.exception.NotFoundException;
import com.photographplatform.api.common.security.SecurityUtils;
import com.photographplatform.api.portfolio.domain.Category;
import com.photographplatform.api.portfolio.dto.CategoryRequest;
import com.photographplatform.api.portfolio.dto.CategoryResponse;
import com.photographplatform.api.portfolio.repository.CategoryRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoryService {

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listAll() {
        return categoryRepository.findAllByOrderBySortOrderAsc()
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public CategoryResponse createCategory(CategoryRequest request) {
        Category category = new Category(request.name());
        category.setTenantId(SecurityUtils.requireCurrentTenantId());
        Category saved = categoryRepository.save(category);
        return toResponse(saved);
    }

    @Transactional
    public CategoryResponse updateCategory(UUID id, CategoryRequest request) {
        Category category = categoryRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Category not found: " + id));
        category.setName(request.name());
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public void deleteCategory(UUID id) {
        categoryRepository.deleteById(id);
    }

    private CategoryResponse toResponse(Category category) {
        return new CategoryResponse(
            category.getId(),
            category.getName(),
            category.getSortOrder(),
            category.getCreatedAt()
        );
    }
}
