package com.photographplatform.api;

import com.photographplatform.api.invoice.repository.InvoiceRepository;
import com.photographplatform.api.payment.repository.PaymentRepository;
import com.photographplatform.api.portfolio.service.PortfolioPublication;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

/**
 * The architecture, stated as tests instead of as a convention people remember.
 *
 * <h2>Why this exists when nothing is broken</h2>
 * The audit found the layering already clean — zero controller-to-repository
 * calls, zero repository-to-service calls, no entity reaching back up. That is
 * precisely the reason to write it down: a rule that is currently kept is cheap
 * to enforce and expensive to re-establish once it has drifted. Nothing here
 * fixes a violation; it stops the first one from being invisible.
 *
 * <p>The audit's other question was whether the patterns in this codebase are
 * actual decisions or accidents. For layering the answer is now checkable
 * rather than a matter of opinion.
 */
class ArchitectureTest {

    private static JavaClasses classes;

    @BeforeAll
    static void importClasses() {
        classes = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.photographplatform.api");
    }

    // ── vertical: the layer stack ────────────────────────────────────────────

    /**
     * Controllers talk to services, services to repositories, and nothing
     * skips a step.
     *
     * <p>{@code common} is excluded from the layer definitions because it is
     * genuinely cross-cutting — filters, interceptors and exception handling
     * sit beside the stack rather than inside it.
     */
    @Test
    @DisplayName("controller → service → repository, and never the other way")
    void layersAreRespected() {
        ArchRule rule = layeredArchitecture().consideringOnlyDependenciesInLayers()
            .layer("Controller").definedBy("..api..controller..")
            .layer("Service").definedBy("..api..service..")
            .layer("Repository").definedBy("..api..repository..")

            .whereLayer("Controller").mayNotBeAccessedByAnyLayer()
            .whereLayer("Service").mayOnlyBeAccessedByLayers("Controller", "Service")
            .whereLayer("Repository").mayOnlyBeAccessedByLayers("Service", "Repository");

        rule.check(classes);
    }

    /**
     * The specific shortcut this rule exists to prevent. Stated separately from
     * the layer rule because it is the one that actually gets taken — a
     * controller needing "just one lookup" is how the boundary erodes, and the
     * failure message should name it directly.
     */
    @Test
    @DisplayName("no controller reaches for a repository")
    void controllersDoNotUseRepositories() {
        ArchRule rule = com.tngtech.archunit.lang.syntax.ArchRuleDefinition
            .noClasses().that().resideInAPackage("..controller..")
            .should().dependOnClassesThat().resideInAPackage("..repository..")
            .because("a controller that queries directly puts business rules in the "
                + "layer least able to reuse or test them");

        rule.check(classes);
    }

    // ── the domain must not know about the plumbing ──────────────────────────

    /**
     * Entities and DTOs are data. A domain object that can reach a repository
     * turns every read into a possible query and makes the persistence boundary
     * impossible to see.
     */
    @Test
    @DisplayName("domain and dto classes stay free of services, repositories and controllers")
    void dataClassesDoNotDependOnBehaviour() {
        ArchRule rule = com.tngtech.archunit.lang.syntax.ArchRuleDefinition
            .noClasses().that().resideInAnyPackage("..domain..", "..dto..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("..service..", "..repository..", "..controller..")
            .because("data classes are shared everywhere; a dependency here reaches "
                + "into every layer at once");

        rule.check(classes);
    }

    // ── horizontal: feature modules ──────────────────────────────────────────

    /**
     * {@code common} must not depend on feature modules.
     *
     * <h2>Why this rule and not "no cycles anywhere"</h2>
     * The obvious rule is {@code slices().should().beFreeOfCycles()}, frozen at
     * today's set. It was written that way first and then removed, because in
     * this codebase it does not work as a ratchet: {@code beFreeOfCycles}
     * records the entire cycle <em>path</em> in each violation, and {@code
     * common} sits in most of the paths. Adding one ordinary dependency into
     * {@code common} — a service picking up the shared rate limiter, say —
     * reshuffles every path and invalidates the whole baseline at once. It did
     * exactly that during this work: one new field, a hundred "new" violations,
     * none of them a new architectural problem.
     *
     * <p>A rule that demands a re-baseline during routine work gets
     * re-baselined reflexively, and then it is checking nothing. So the
     * enforcement is aimed at the cycle that actually means something instead.
     *
     * <h2>What it means</h2>
     * Feature modules depending on each other is ordinary domain coupling — an
     * invoice needs its booking, a booking needs to know whether it was paid.
     * {@code common} is different: it is the module everything else is allowed
     * to depend on, and the moment it depends back on a feature it stops being
     * common and becomes a second place where the application's business rules
     * live.
     *
     * <p>Three such dependencies exist today ({@code WriteAccessInterceptor} →
     * entitlement, {@code EmailVerificationInterceptor} → auth,
     * {@code TenantJobRunner} → tenant). Each is a cross-cutting gate that
     * genuinely needs domain state, so they are frozen rather than removed —
     * but they are a short, stable list that shrinks as they are paid down, and
     * a fourth one fails the build.
     *
     * <p>To record a new baseline after deliberately changing the structure —
     * not to make a failing build pass:
     * {@code mvn test -Dtest=ArchitectureTest -Darchunit.freeze.refreeze=true}
     */
    @Test
    @DisplayName("common does not depend on feature modules")
    void commonStaysCommon() {
        ArchRule rule = com.tngtech.archunit.library.freeze.FreezingArchRule.freeze(
            com.tngtech.archunit.lang.syntax.ArchRuleDefinition
                .noClasses().that().resideInAPackage("..api.common..")
                .should().dependOnClassesThat()
                .resideInAnyPackage(
                    "..api.auth..", "..api.billing..", "..api.booking..", "..api.client..",
                    "..api.entitlement..", "..api.gallery..", "..api.inquiry..",
                    "..api.invoice..", "..api.lead..", "..api.notification..",
                    "..api.payment..", "..api.portfolio..", "..api.pricing..", "..api.tenant..")
                .because("common is what every feature may depend on; depending back "
                    + "turns it into a second home for business rules"));

        rule.check(classes);
    }

    // ── Customer messages ────────────────────────────────────────────────────

    /**
     * {@code messaging} is a leaf: modules publish events, and it listens.
     *
     * <p>A feature module that called it directly would be back to deciding,
     * on its own terms, who speaks to a Customer and how, which is the
     * scattering this module exists to end.
     */
    @Test
    @DisplayName("no module depends on messaging")
    void nothingDependsOnMessaging() {
        ArchRule rule = com.tngtech.archunit.lang.syntax.ArchRuleDefinition
            .noClasses().that().resideOutsideOfPackage("..api.messaging..")
            .should().dependOnClassesThat().resideInAPackage("..api.messaging..")
            .because("feature modules publish domain events; messaging listens to them");

        rule.check(classes);
    }

    /**
     * {@code messaging} reads the publishing modules' events, the studio's
     * identity ({@code tenant}, and {@code entitlement} for the white-label
     * check) and queues through {@code notification}. Nothing else: not a
     * feature module's services, and so never its rows.
     *
     * <p>One named exception: {@link PortfolioPublication}, whether the
     * portfolio shows anything, which decides if Enquiry received links to it.
     * The class, not the package: the question is the only thing allowed (#127).
     */
    @Test
    @DisplayName("messaging depends only on events, tenant, entitlement, notification, common "
        + "and whether the portfolio is published")
    void messagingDependsOnlyOnItsInputs() {
        ArchRule rule = com.tngtech.archunit.lang.syntax.ArchRuleDefinition
            .classes().that().resideInAPackage("..api.messaging..")
            .should().onlyDependOnClassesThat(
                JavaClass.Predicates.resideOutsideOfPackage("com.photographplatform.api..")
                    .or(JavaClass.Predicates.resideInAnyPackage(
                        "..api.messaging..", "..api.common..", "..api.tenant..", "..api.entitlement..",
                        "..api.notification..", "..api.*.event.."))
                    .or(JavaClass.Predicates.equivalentTo(PortfolioPublication.class))
                    .as("events, tenant, entitlement, notification, common, PortfolioPublication "
                        + "or outside the application"))
            .because("messaging composes Customer messages from events; it must not reach into "
                + "the modules that publish them");

        rule.check(classes);
    }

    /**
     * {@code gallery} says what happened to a gallery and stops there: the
     * expiry warning used to be queued from the retention job by calling
     * {@code notification} directly, in German only. It now publishes
     * {@code GalleryExpiringEvent}, like the send publishes
     * {@code GalleryDeliveredEvent}, and the dependency is gone. This keeps it
     * gone rather than freezing a baseline it could creep back into.
     */
    @Test
    @DisplayName("gallery does not depend on notification")
    void galleryPublishesInsteadOfQueueingEmail() {
        ArchRule rule = com.tngtech.archunit.lang.syntax.ArchRuleDefinition
            .noClasses().that().resideInAPackage("..api.gallery..")
            .should().dependOnClassesThat().resideInAPackage("..api.notification..")
            .because("gallery publishes domain events; messaging writes to the Customer");

        rule.check(classes);
    }

    // ── Settlement ownership (ADR-004 §1) ────────────────────────────────────

    /**
     * Only {@code invoice} touches {@link InvoiceRepository}.
     *
     * <p>Settlement (Live, Outstanding, Overdue) used to be worked out in three
     * modules, each straight from the rows, and the copies disagreed. Every
     * caller now asks {@code invoice.service.Settlement}; a module that goes
     * back to the repository is a fourth copy in the making. Payment's row
     * lock goes through {@code Settlement#lockForPayment} for the same reason.
     */
    @Test
    @DisplayName("only invoice touches the invoice repository")
    void invoiceRepositoryIsModulePrivate() {
        ArchRule rule = com.tngtech.archunit.lang.syntax.ArchRuleDefinition
            .noClasses().that().resideOutsideOfPackage("..api.invoice..")
            .should().dependOnClassesThat().belongToAnyOf(InvoiceRepository.class)
            .because("Settlement is owned by invoice; ask invoice.service.Settlement instead of "
                + "reading invoice rows (ADR-004 §1)");

        rule.check(classes);
    }

    /**
     * Only {@code payment} touches {@link PaymentRepository}. Invoice gets
     * succeeded totals from {@code payment.service.SucceededPayments}, so what
     * counts as a succeeded payment is decided in one place.
     *
     * <p>Named classes rather than the whole {@code payment.repository}
     * package: billing shares {@code ProcessedStripeEventRepository} for
     * Stripe event idempotency, which has nothing to do with Settlement.
     */
    @Test
    @DisplayName("only payment touches the payment repository")
    void paymentRepositoryIsModulePrivate() {
        ArchRule rule = com.tngtech.archunit.lang.syntax.ArchRuleDefinition
            .noClasses().that().resideOutsideOfPackage("..api.payment..")
            .should().dependOnClassesThat().belongToAnyOf(PaymentRepository.class)
            .because("payment owns its rows; read succeeded totals through "
                + "payment.service.SucceededPayments (ADR-004 §1)");

        rule.check(classes);
    }

    // ── the community boundary (ADR-003) ─────────────────────────────────────

    /**
     * Community data is a second data domain, not a relaxation of the first.
     *
     * <p>Its tables carry no RLS tenant policy — that is the whole point, since
     * a locations map or a studio search has to read other tenants' rows
     * (ADR-003 §2). The consequence is that {@code owner_tenant_id} is checked
     * by hand, in the service layer, on every write. So a caller that reaches a
     * community repository directly is not merely coupling to the wrong layer:
     * it is skipping the only authorisation there is.
     *
     * <p>Stated separately from the layer rules for that reason — the failure
     * message should say "authorisation", not "layering".
     *
     * <p>Nothing matches yet; no community feature is built. The rule is written
     * now on purpose, so the fence is already standing when the first one lands
     * rather than being remembered afterwards.
     */
    @Test
    @DisplayName("community repositories stay inside the community module")
    void communityRepositoriesAreModulePrivate() {
        ArchRule rule = com.tngtech.archunit.lang.syntax.ArchRuleDefinition
            .noClasses().that().resideOutsideOfPackage("..api.community..")
            .should().dependOnClassesThat().resideInAPackage("..api.community.repository..")
            .because("community rows have no RLS backstop — owner_tenant_id is checked in "
                + "the community service, and a caller that goes around it goes around the "
                + "only check there is (ADR-003 §2.4, §3)");

        rule.check(classes);
    }
}
