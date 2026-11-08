package com.photographplatform.api.gallery.controller;

import com.photographplatform.api.gallery.dto.CustomerGalleryResponse;
import com.photographplatform.api.gallery.service.CustomerGalleryService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The client's own galleries.
 *
 * <p>Separate from {@link GalleryController} for the reason {@code
 * CustomerInvoiceController} is: that one is the studio's management surface,
 * closed to CUSTOMER tokens, while this takes no id and derives ownership from
 * the caller. Under {@code /api/customer/**}, which {@code SecurityConfig}
 * gates to CUSTOMER.
 */
@RestController
@RequestMapping("/api/customer/galleries")
public class CustomerGalleryController {

    private final CustomerGalleryService customerGalleryService;

    public CustomerGalleryController(CustomerGalleryService customerGalleryService) {
        this.customerGalleryService = customerGalleryService;
    }

    @GetMapping
    public ResponseEntity<List<CustomerGalleryResponse>> listOwn() {
        return ResponseEntity.ok(customerGalleryService.listForCustomer());
    }
}
