package com.photographplatform.api.client.dto;

import com.photographplatform.api.booking.dto.BookingResponse;
import com.photographplatform.api.contract.dto.ContractResponse;
import com.photographplatform.api.gallery.dto.GalleryResponse;
import com.photographplatform.api.invoice.dto.InvoiceResponse;
import java.util.List;

/**
 * One client with everything the studio holds on them: their bookings in
 * every status, and the galleries, invoices and contracts hung off those
 * bookings. Each list is its owner module's own response, so a row here
 * says exactly what that module's screen says about it.
 */
public record ClientDetailResponse(
    ClientResponse client,
    List<BookingResponse> bookings,
    List<GalleryResponse> galleries,
    List<InvoiceResponse> invoices,
    List<ContractResponse> contracts
) {}
