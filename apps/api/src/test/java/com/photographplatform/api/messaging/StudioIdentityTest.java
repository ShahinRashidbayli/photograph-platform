package com.photographplatform.api.messaging;

import com.photographplatform.api.messaging.domain.StudioIdentity;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Who speaks in a Customer message, when the studio has filled in less than everything. */
class StudioIdentityTest {

    @Test
    void speaksUnderTheBusinessNameAndRepliesToTheImpressumAddress() {
        StudioIdentity studio = StudioIdentity.resolve(
            "Lichtblick Fotografie", "Anna Schmidt", "kontakt@lichtblick.de", "anna@gmail.com", false, null, null);

        assertThat(studio.displayName()).isEqualTo("Lichtblick Fotografie");
        assertThat(studio.replyTo()).isEqualTo("kontakt@lichtblick.de");
    }

    @Test
    void fallsBackToTheLegalNameWithoutABusinessName() {
        StudioIdentity studio = StudioIdentity.resolve(null, "Anna Schmidt", null, "anna@gmail.com", false, null, null);

        assertThat(studio.displayName()).isEqualTo("Anna Schmidt");
    }

    @Test
    void treatsABlankBusinessNameAsMissing() {
        StudioIdentity studio = StudioIdentity.resolve("  ", "Anna Schmidt", null, "anna@gmail.com", false, null, null);

        assertThat(studio.displayName()).isEqualTo("Anna Schmidt");
    }

    @Test
    void repliesToTheOwnerWithoutALegalEmail() {
        StudioIdentity studio = StudioIdentity.resolve("Lichtblick", null, " ", "anna@gmail.com", false, null, null);

        assertThat(studio.replyTo()).isEqualTo("anna@gmail.com");
    }

    @Test
    void hasNoNameRatherThanTheSubdomainWhenTheStudioSetNone() {
        StudioIdentity studio = StudioIdentity.resolve(null, null, null, "anna@gmail.com", false, null, null);

        assertThat(studio.displayName()).isNull();
    }

    @Test
    void keepsLogoAndColourOnlyWithWhiteLabel() {
        StudioIdentity whiteLabel = StudioIdentity.resolve(
            "Lichtblick", null, null, "anna@gmail.com", true, "https://app.fotolio.de/logo", "#AA3366");
        StudioIdentity other = StudioIdentity.resolve(
            "Lichtblick", null, null, "anna@gmail.com", false, "https://app.fotolio.de/logo", "#AA3366");

        assertThat(whiteLabel.logoUrl()).isEqualTo("https://app.fotolio.de/logo");
        assertThat(whiteLabel.brandColor()).isEqualTo("#AA3366");
        assertThat(other.logoUrl()).isNull();
        assertThat(other.brandColor()).isNull();
    }

    @Test
    void dropsAColourThatIsNotAHexCode() {
        StudioIdentity studio = StudioIdentity.resolve(
            "Lichtblick", null, null, "anna@gmail.com", true, null, "red;background:url(x)");

        assertThat(studio.brandColor()).isNull();
    }
}
