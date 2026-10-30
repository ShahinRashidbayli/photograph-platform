package com.photographplatform.api.portfolio.controller;

import com.photographplatform.api.common.security.RequiresVerifiedEmail;
import com.photographplatform.api.portfolio.dto.CategoryRequest;
import com.photographplatform.api.portfolio.dto.CategoryResponse;
import com.photographplatform.api.portfolio.service.CategoryService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping("/portfolio/categories")
    public ResponseEntity<List<CategoryResponse>> listCategories() {
        List<CategoryResponse> categories = categoryService.listAll();
        return ResponseEntity.ok(categories);
    }

    @RequiresVerifiedEmail
    @PostMapping("/portfolio/categories")
    public ResponseEntity<CategoryResponse> createCategory(
        @Valid @RequestBody CategoryRequest request
    ) {
        CategoryResponse category = categoryService.createCategory(request);
        return ResponseEntity.ok(category);
    }

    @RequiresVerifiedEmail
    @PatchMapping("/portfolio/categories/{id}")
    public ResponseEntity<CategoryResponse> updateCategory(
        @PathVariable UUID id,
        @Valid @RequestBody CategoryRequest request
    ) {
        CategoryResponse category = categoryService.updateCategory(id, request);
        return ResponseEntity.ok(category);
    }

    @RequiresVerifiedEmail
    @DeleteMapping("/portfolio/categories/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable UUID id) {
        categoryService.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }
}
