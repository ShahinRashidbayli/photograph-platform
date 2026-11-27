package com.photographplatform.api.booking.dto;

import com.photographplatform.api.common.domain.CustomerLanguage;

/**
 * Who a Customer message about a booking goes to, and in which language.
 *
 * <p>For modules that write to the Customer about something hung off a
 * booking (a gallery): they ask booking for this rather than reading the
 * booking row themselves.
 *
 * @param email    the booking's Customer address; may be blank on a record
 *                 entered by hand
 * @param name     how the studio knows them; may be blank
 * @param language the language every Customer message about the booking is
 *                 written in
 */
public record BookingCustomer(String email, String name, CustomerLanguage language) {
}
