package com.photographplatform.api;

import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

/**
 * Keeps the test configuration honest about the production one.
 *
 * <h2>The problem this stands in for</h2>
 * {@code src/test/resources/application.yml} does not overlay
 * {@code src/main/resources/application.yml} — it <em>replaces</em> it. Both
 * resolve to {@code classpath:/application.yml} and test-classes wins, so the
 * production file is never read during a test run and every setting the suite
 * needs has to be restated by hand. Anything added to production config after
 * that is invisible to the tests, silently.
 *
 * <p>That is not theoretical. Adding {@code server.forward-headers-strategy} to
 * production config left the proxy-header protection absent under test, and the
 * only reason it surfaced was a test written to assert the valve exists.
 *
 * <h2>Why not just fix it properly</h2>
 * The structural fix — rename to {@code application-test.yml} and activate a
 * {@code test} profile — is more invasive than it looks, and the file's own
 * header says so. Two things break immediately:
 *
 * <ul>
 *   <li>Production sets {@code spring.flyway.enabled: false} on purpose (the
 *       runtime role has no DDL rights; migrations are a release step). Tests
 *       need Flyway to <em>run</em>, so the overlay would have to switch it
 *       back on — reintroducing precisely the escape hatch that setting exists
 *       to refuse.</li>
 *   <li>{@code R2StorageService} is {@code @ConditionalOnProperty("app.r2.endpoint")},
 *       and production defaults that to a placeholder. Inheriting it would
 *       create the bean in every test, where today it is absent — flipping
 *       {@code Optional<R2StorageService>} from empty to present across the
 *       suite.</li>
 * </ul>
 *
 * <p>Both are solvable, but not blind, and the migration is worth doing on its
 * own with attention rather than folded into unrelated work. Meanwhile the
 * actual risk — the two files drifting apart unnoticed — is what this test
 * closes. Every key below has to be present in both and agree, so production
 * tuning cannot be added without the suite either picking it up or failing.
 */
class ConfigMirrorTest {

    /**
     * Settings whose value changes what the tests actually exercise. Not every
     * key: connection URLs, secrets and credentials are legitimately different,
     * and demanding they match would make the test meaningless noise.
     *
     * <p>Add to this list whenever production config gains something that
     * changes behaviour rather than environment.
     */
    private static final List<String> MUST_AGREE = List.of(
        // Hibernate write path — batching changes statement counts, which
        // several tests assert on indirectly through query behaviour.
        "spring.jpa.hibernate.ddl-auto",
        "spring.jpa.open-in-view",
        "spring.jpa.properties.hibernate.jdbc.batch_size",
        "spring.jpa.properties.hibernate.order_inserts",
        "spring.jpa.properties.hibernate.order_updates",
        "spring.jpa.properties.hibernate.query.in_clause_parameter_padding",

        // Proxy handling — the one that already drifted. Without these the
        // RemoteIpValve is simply absent under test and ClientIp silently
        // falls back to the raw socket address.
        "server.forward-headers-strategy",
        "server.tomcat.remoteip.internal-proxies",

        // Plan entitlements. EntitlementProperties refuses to start with a
        // tier missing, so a mismatch here is the difference between a gate
        // being tested and a gate being assumed.
        "app.plans.tiers.starter.gallery-retention-days",
        "app.plans.tiers.pro.gallery-retention-days",
        "app.plans.tiers.studio.gallery-retention-days",
        "app.plans.tiers.starter.seats",
        "app.plans.tiers.studio.seats");

    /** Pulls {@code default} out of {@code ${SOME_VAR:default}}. */
    private static final Pattern PLACEHOLDER = Pattern.compile("^\\$\\{[^:}]+:?(.*)}$");

    @Test
    @DisplayName("test config restates every production setting that changes behaviour")
    void testConfigMirrorsProduction() {
        Map<String, Object> main = flatten(load("/application.yml", true));
        Map<String, Object> test = flatten(load("/application.yml", false));

        StringBuilder problems = new StringBuilder();
        for (String key : MUST_AGREE) {
            Object mainValue = main.get(key);
            Object testValue = test.get(key);

            if (mainValue == null) {
                problems.append("\n  - ").append(key)
                    .append(" is no longer in src/main/resources/application.yml; "
                        + "remove it from MUST_AGREE or restore it");
                continue;
            }
            if (testValue == null) {
                problems.append("\n  - ").append(key)
                    .append(" is set in production config but MISSING from "
                        + "src/test/resources/application.yml (expected ")
                    .append(normalise(mainValue)).append(")");
                continue;
            }
            if (!normalise(mainValue).equals(normalise(testValue))) {
                problems.append("\n  - ").append(key).append(" disagrees: production=")
                    .append(normalise(mainValue)).append(", test=").append(normalise(testValue));
            }
        }

        if (!problems.isEmpty()) {
            fail("Test configuration has drifted from production configuration."
                + "\n\nsrc/test/resources/application.yml REPLACES the production file rather "
                + "than overlaying it, so anything added to production config is invisible "
                + "to the suite until it is restated there by hand:"
                + problems
                + "\n\nMirror the setting, or drop it from ConfigMirrorTest.MUST_AGREE if it "
                + "genuinely does not affect what the tests exercise.\n");
        }
    }

    @Test
    @DisplayName("the two config files are actually two different files")
    void bothFilesExist() {
        // If the structural fix ever lands, the test file stops shadowing the
        // production one and this whole test class becomes unnecessary. Better
        // to notice that than to keep comparing a file against itself.
        assertThat(load("/application.yml", true)).isNotEmpty();
        assertThat(load("/application.yml", false)).isNotEmpty();
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /**
     * Both files answer to the same classpath name, so they cannot be told
     * apart by resource lookup — the test one always wins. They are read off
     * disk instead, which is the only way to see both.
     */
    private Map<String, Object> load(String ignoredClasspathName, boolean production) {
        String path = production
            ? "src/main/resources/application.yml"
            : "src/test/resources/application.yml";
        try (InputStream in = java.nio.file.Files.newInputStream(java.nio.file.Path.of(path))) {
            Map<String, Object> parsed = new Yaml().load(in);
            return parsed == null ? Map.of() : parsed;
        } catch (Exception ex) {
            throw new IllegalStateException("Could not read " + path, ex);
        }
    }

    /** {@code {a: {b: 1}}} becomes {@code {"a.b": 1}}. */
    private Map<String, Object> flatten(Map<String, Object> nested) {
        Map<String, Object> flat = new LinkedHashMap<>();
        flatten("", nested, flat);
        return flat;
    }

    @SuppressWarnings("unchecked")
    private void flatten(String prefix, Map<String, Object> nested, Map<String, Object> out) {
        nested.forEach((key, value) -> {
            String path = prefix.isEmpty() ? String.valueOf(key) : prefix + "." + key;
            if (value instanceof Map<?, ?> child) {
                flatten(path, (Map<String, Object>) child, out);
            } else {
                out.put(path, value);
            }
        });
    }

    /**
     * Production values are usually {@code ${ENV_VAR:default}} and test values
     * are literals. Comparing the raw strings would report drift on every one
     * of them, so the placeholder's default is what gets compared.
     */
    private String normalise(Object value) {
        String text = String.valueOf(value).trim();
        Matcher matcher = PLACEHOLDER.matcher(text);
        return matcher.matches() ? matcher.group(1).trim() : text;
    }
}
