package com.photographplatform.api.common.util;

import java.util.Locale;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The whole point of {@link Normalize} is that it does not depend on the JVM's
 * default locale, so these tests deliberately install {@code tr_TR} — the
 * locale whose casing rules break naive {@code toLowerCase()}/{@code
 * toUpperCase()} on ASCII {@code i}/{@code I}.
 */
class NormalizeTest {

    private final Locale original = Locale.getDefault();

    @AfterEach
    void restoreLocale() {
        Locale.setDefault(original);
    }

    @Test
    void emailLowercasingIsUnaffectedByTheTurkishLocale() {
        Locale.setDefault(Locale.of("tr", "TR"));

        // Sanity check that this locale really is the hostile one — if a future
        // JDK changes these rules the test below stops proving anything.
        assertThat("IRIS".toLowerCase()).isNotEqualTo("iris");

        assertThat(Normalize.email("  IRIS@Example.COM ")).isEqualTo("iris@example.com");
    }

    @Test
    void subdomainLowercasingIsUnaffectedByTheTurkishLocale() {
        Locale.setDefault(Locale.of("tr", "TR"));
        assertThat(Normalize.lower(" StudioIsik ")).isEqualTo("studioisik");
    }

    @Test
    void uppercasingIsUnaffectedByTheTurkishLocale() {
        Locale.setDefault(Locale.of("tr", "TR"));
        assertThat(Normalize.upper(" chf ")).isEqualTo("CHF");
        assertThat(Normalize.upper("accepted")).isEqualTo("ACCEPTED");
    }

    @Test
    void trimToNullCollapsesAbsentAndEmpty() {
        assertThat(Normalize.trimToNull(null)).isNull();
        assertThat(Normalize.trimToNull("   ")).isNull();
        assertThat(Normalize.trimToNull("  Berlin ")).isEqualTo("Berlin");
    }

    @Test
    void everyHelperIsNullSafe() {
        assertThat(Normalize.email(null)).isNull();
        assertThat(Normalize.lower(null)).isNull();
        assertThat(Normalize.upper(null)).isNull();
    }
}
