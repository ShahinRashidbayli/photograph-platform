package com.photographplatform.api.common.domain;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Maps {@link CustomerLanguage} to the lowercase code the {@code language}
 * columns store. Not {@code @Enumerated(STRING)}: that would write {@code DE},
 * which the columns' CHECK constraint rejects (V40).
 *
 * <p>Not auto-applied; each mapped field names it with {@code @Convert}, so a
 * reader of the entity sees how the column is written.
 */
@Converter
public class CustomerLanguageConverter implements AttributeConverter<CustomerLanguage, String> {

    @Override
    public String convertToDatabaseColumn(CustomerLanguage language) {
        return language == null ? null : language.code();
    }

    @Override
    public CustomerLanguage convertToEntityAttribute(String code) {
        return code == null ? null : CustomerLanguage.fromCode(code);
    }
}
