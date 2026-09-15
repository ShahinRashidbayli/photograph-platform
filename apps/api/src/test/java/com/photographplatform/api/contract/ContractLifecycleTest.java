package com.photographplatform.api.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.photographplatform.api.contract.domain.Contract;
import com.photographplatform.api.contract.domain.ContractStatus;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * The rules that make a signature worth anything.
 *
 * <p>These live on the entity rather than in {@code ContractService}, so they
 * are tested here without a Spring context — which is the point of having put
 * them there.
 */
class ContractLifecycleTest {

    private static final OffsetDateTime NOW =
        OffsetDateTime.of(2026, 9, 4, 12, 0, 0, 0, ZoneOffset.UTC);

    private Contract draft() {
        return new Contract(
            UUID.randomUUID(), UUID.randomUUID(),
            "Fotografie-Vertrag", "Ursprünglicher Text",
            "Anna Beispiel", "anna@example.de");
    }

    private Contract sent() {
        Contract c = draft();
        c.send(NOW, "Studio Müller", "Grünstraße 3, 10115 Berlin", "hallo@studio.de");
        return c;
    }

    @Nested
    @DisplayName("editing")
    class Editing {

        @Test
        void aDraftCanBeRewritten() {
            Contract c = draft();
            c.edit("Neuer Titel", "Neuer Text");

            assertThat(c.getTitle()).isEqualTo("Neuer Titel");
            assertThat(c.getBody()).isEqualTo("Neuer Text");
            assertThat(c.isEditable()).isTrue();
        }

        @Test
        @DisplayName("a sent contract cannot be edited — the recipient has already read it")
        void aSentContractIsFrozen() {
            Contract c = sent();

            assertThatThrownBy(() -> c.edit("Heimlich", "Andere Bedingungen"))
                .isInstanceOf(IllegalStateException.class);
            assertThat(c.getBody()).isEqualTo("Ursprünglicher Text");
            assertThat(c.isEditable()).isFalse();
        }
    }

    @Nested
    @DisplayName("sending")
    class Sending {

        @Test
        void sendingFreezesTheIssuerIdentity() {
            Contract c = sent();

            assertThat(c.getStatus()).isEqualTo(ContractStatus.SENT);
            assertThat(c.getIssuerName()).isEqualTo("Studio Müller");
            assertThat(c.getIssuerAddress()).isEqualTo("Grünstraße 3, 10115 Berlin");
            assertThat(c.getSentAt()).isEqualTo(NOW);
        }

        @Test
        void aContractCannotBeSentTwice() {
            Contract c = sent();

            assertThatThrownBy(() -> c.send(NOW, "Jemand anders", null, null))
                .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    @DisplayName("signing")
    class Signing {

        @Test
        void signingRecordsWhoWhenAndOverWhatText() {
            Contract c = sent();
            UUID signer = UUID.randomUUID();

            c.sign("Anna Beispiel", signer, "203.0.113.7", "Mozilla/5.0", NOW);

            assertThat(c.getStatus()).isEqualTo(ContractStatus.SIGNED);
            assertThat(c.getSignerName()).isEqualTo("Anna Beispiel");
            assertThat(c.getSignerUserId()).isEqualTo(signer);
            assertThat(c.getSignerIp()).isEqualTo("203.0.113.7");
            assertThat(c.getSignedAt()).isEqualTo(NOW);
            assertThat(c.getBodySha256()).hasSize(64);
        }

        @Test
        @DisplayName("a draft cannot be signed — nobody was asked to")
        void aDraftCannotBeSigned() {
            Contract c = draft();

            assertThatThrownBy(() -> c.sign("Anna", UUID.randomUUID(), null, null, NOW))
                .isInstanceOf(IllegalStateException.class);
        }

        @Test
        @DisplayName("signing twice is refused, so the second signer cannot overwrite the first")
        void signingIsSingleUse() {
            Contract c = sent();
            c.sign("Anna Beispiel", UUID.randomUUID(), null, null, NOW);

            assertThatThrownBy(() -> c.sign("Jemand Anders", UUID.randomUUID(), null, null, NOW))
                .isInstanceOf(IllegalStateException.class);
            assertThat(c.getSignerName()).isEqualTo("Anna Beispiel");
        }
    }

    @Nested
    @DisplayName("tamper evidence")
    class TamperEvidence {

        @Test
        void anUnsignedContractIsNotClaimedIntact() {
            // Nothing to compare against; "intact" would be a claim about a
            // signature that does not exist.
            assertThat(draft().isIntact()).isFalse();
            assertThat(sent().isIntact()).isFalse();
        }

        @Test
        void aSignedContractHashesToItsOwnText() {
            Contract c = sent();
            c.sign("Anna", UUID.randomUUID(), null, null, NOW);

            assertThat(c.isIntact()).isTrue();
        }

        @Test
        @DisplayName("altering the text after signature is detectable")
        void alteredTextBreaksTheHash() {
            Contract c = sent();
            c.sign("Anna", UUID.randomUUID(), null, null, NOW);
            String signedHash = c.getBodySha256();

            // Reaching past edit()'s refusal the way a bad migration or a stray
            // SQL UPDATE would — the case the stored hash exists to catch.
            forceBody(c, "Ursprünglicher Text, plus eine Klausel die niemand unterschrieben hat");

            assertThat(c.isIntact()).isFalse();
            assertThat(c.getBodySha256())
                .as("the recorded hash must not move with the text it is checking")
                .isEqualTo(signedHash);
        }

        @Test
        void theHashIsOverTheBodyAloneAndIsStable() {
            Contract a = sent();
            Contract b = sent();
            a.sign("Anna", UUID.randomUUID(), null, null, NOW);
            b.sign("Jemand Anders", UUID.randomUUID(), "different-ip", null, NOW.plusDays(3));

            assertThat(a.getBodySha256())
                .as("same text signed by different people must hash the same")
                .isEqualTo(b.getBodySha256());
        }
    }

    @Nested
    @DisplayName("cancelling")
    class Cancelling {

        @Test
        void aDraftOrSentContractCanBeWithdrawn() {
            Contract d = draft();
            d.cancel(NOW);
            assertThat(d.getStatus()).isEqualTo(ContractStatus.CANCELLED);
            assertThat(d.getCancelledAt()).isEqualTo(NOW);

            Contract s = sent();
            s.cancel(NOW);
            assertThat(s.getStatus()).isEqualTo(ContractStatus.CANCELLED);
        }

        @Test
        @DisplayName("a signed contract cannot be cancelled — that would unmake a signature")
        void aSignedContractCannotBeCancelled() {
            Contract c = sent();
            c.sign("Anna", UUID.randomUUID(), null, null, NOW);

            assertThatThrownBy(() -> c.cancel(NOW))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("signed");
        }

        @Test
        void cancellingTwiceIsRefused() {
            Contract c = draft();
            c.cancel(NOW);

            assertThatThrownBy(() -> c.cancel(NOW)).isInstanceOf(IllegalStateException.class);
        }
    }

    /** Writes `body` directly, bypassing the lifecycle guard, as a stray UPDATE would. */
    private static void forceBody(Contract contract, String body) {
        try {
            var field = Contract.class.getDeclaredField("body");
            field.setAccessible(true);
            field.set(contract, body);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("Contract.body moved — update this test", e);
        }
    }
}
