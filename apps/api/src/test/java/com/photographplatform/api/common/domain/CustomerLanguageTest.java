package com.photographplatform.api.common.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CustomerLanguageTest {

    private final CustomerLanguageConverter converter = new CustomerLanguageConverter();

    @Test
    void writesTheLowercaseCodeTheCheckConstraintAllows() {
        assertThat(converter.convertToDatabaseColumn(CustomerLanguage.DE)).isEqualTo("de");
        assertThat(converter.convertToDatabaseColumn(CustomerLanguage.EN)).isEqualTo("en");
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
    }

    @Test
    void readsTheStoredCode() {
        assertThat(converter.convertToEntityAttribute("de")).isEqualTo(CustomerLanguage.DE);
        assertThat(converter.convertToEntityAttribute("en")).isEqualTo(CustomerLanguage.EN);
        assertThat(converter.convertToEntityAttribute(null)).isNull();
    }

    /** The web app sends its locale; tolerate case and padding, nothing else. */
    @Test
    void parsesCodesCaseInsensitively() {
        assertThat(CustomerLanguage.fromCode(" EN ")).isEqualTo(CustomerLanguage.EN);
        assertThat(CustomerLanguage.fromCode("De")).isEqualTo(CustomerLanguage.DE);
    }

    @Test
    void rejectsAnythingElse() {
        assertThatThrownBy(() -> CustomerLanguage.fromCode("fr"))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CustomerLanguage.fromCode(null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void recordsEnteredByHandDefaultToGerman() {
        assertThat(CustomerLanguage.DEFAULT).isEqualTo(CustomerLanguage.DE);
    }
}
