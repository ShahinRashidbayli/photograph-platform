package com.photographplatform.api.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photographplatform.api.messaging.domain.PersonalNote;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PersonalNoteTest {

    @Test
    void rendersMarkupAsText() {
        PersonalNote note = new PersonalNote("<script>alert('x')</script>");

        assertThat(note.html())
            .doesNotContain("<script>")
            .isEqualTo("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    }

    @Test
    void keepsLineBreaks() {
        assertThat(new PersonalNote("Liebe Maria,\r\nbis bald!").html()).isEqualTo("Liebe Maria,<br>bis bald!");
    }

    @Test
    void acceptsAThousandCharacters() {
        assertThat(new PersonalNote("a".repeat(1000)).text()).hasSize(1000);
    }

    @Test
    void rejectsAThousandAndOne() {
        assertThatThrownBy(() -> new PersonalNote("a".repeat(1001)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("1000");
    }

    @Test
    void anEmptyFieldIsNoNote() {
        assertThat(PersonalNote.ofNullable(null)).isNull();
        assertThat(PersonalNote.ofNullable("   ")).isNull();
        assertThat(PersonalNote.ofNullable(" Danke! ").text()).isEqualTo("Danke!");
    }

    /** It travels in the outbox params as JSON. */
    @Test
    void survivesTheOutbox() throws Exception {
        ObjectMapper json = new ObjectMapper();
        PersonalNote note = new PersonalNote("Bis Samstag!");

        assertThat(json.readValue(json.writeValueAsString(note), PersonalNote.class)).isEqualTo(note);
    }
}
