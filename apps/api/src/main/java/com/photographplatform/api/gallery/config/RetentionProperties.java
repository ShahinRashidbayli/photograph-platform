package com.photographplatform.api.gallery.config;

import jakarta.annotation.PostConstruct;
import java.util.Comparator;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Knobs on the most destructive job in the product (ADR-001).
 *
 * <p>Everything here has a safe default, and the two switches default to the
 * conservative reading of ADR-001 §4: warnings and expiry are on, but the
 * irreversible phase is opt-in per environment. A staging database restored
 * from a production dump would otherwise start deleting real customers' photos
 * out of real object storage on its first night.
 */
@Component
@ConfigurationProperties(prefix = "app.retention")
public class RetentionProperties {

    /** Master switch for the whole sweep — reminders included. */
    private boolean enabled = true;

    /**
     * The irreversible phase: actually destroying bytes in object storage.
     *
     * <p>Off by default. ADR-001 §4.4 makes the AGB wording a precondition for
     * the first deletion, and a deployment that has not confirmed its own
     * terms should expire and warn without ever purging. Turning this off also
     * gives an operator a one-flag stop button that leaves the rest of the job
     * working.
     */
    private boolean purgeEnabled;

    /**
     * Days between losing access and losing the bytes (ADR-001 §4.3).
     *
     * <p>This is the margin for our own bugs. Thirty days is chosen so that a
     * wrongly-expired gallery survives a full billing cycle of nobody noticing
     * — long enough for the photographer to come back from a shooting season
     * and say "where did that go?" while it is still recoverable.
     */
    private int graceDays = 30;

    /**
     * When to warn the client, in days before expiry.
     *
     * <p>ADR-001 §4.1 words these as days 45/55/59 of a 60-day window;
     * expressed as "days before expiry" the same three warnings generalise to
     * Pro's year and Studio's two, where "day 45" would otherwise mean a
     * reminder ten months early.
     */
    private List<Integer> reminderDaysBefore = List.of(15, 5, 1);

    /**
     * Per-tenant cap on galleries touched per phase per run (ADR-001 §4:
     * "idempotent and rate-limited").
     *
     * <p>Bounds both the object-storage call volume and the blast radius of a
     * wrong query: a bug that selects every gallery in the system deletes at
     * most this many per tenant per night, which leaves time to notice.
     */
    private int maxPerRun = 200;

    /** 03:00 in the business timezone — outside German working hours. */
    private String cron = "0 0 3 * * *";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isPurgeEnabled() {
        return purgeEnabled;
    }

    public void setPurgeEnabled(boolean purgeEnabled) {
        this.purgeEnabled = purgeEnabled;
    }

    public int getGraceDays() {
        return graceDays;
    }

    public void setGraceDays(int graceDays) {
        this.graceDays = graceDays;
    }

    public List<Integer> getReminderDaysBefore() {
        return reminderDaysBefore;
    }

    public void setReminderDaysBefore(List<Integer> reminderDaysBefore) {
        this.reminderDaysBefore = reminderDaysBefore;
    }

    public int getMaxPerRun() {
        return maxPerRun;
    }

    public void setMaxPerRun(int maxPerRun) {
        this.maxPerRun = maxPerRun;
    }

    public String getCron() {
        return cron;
    }

    public void setCron(String cron) {
        this.cron = cron;
    }

    /** Thresholds most-urgent-first, which is the order the job needs them in. */
    public List<Integer> sortedThresholds() {
        return reminderDaysBefore.stream().sorted(Comparator.naturalOrder()).toList();
    }

    @PostConstruct
    public void validate() {
        if (graceDays < 1) {
            throw new IllegalStateException(
                "app.retention.grace-days must be at least 1. A zero-day grace period makes "
                    + "expiry and destruction the same event, removing the margin ADR-001 §4.3 "
                    + "requires for our own bugs.");
        }
        if (reminderDaysBefore.isEmpty()) {
            throw new IllegalStateException(
                "app.retention.reminder-days-before must not be empty. ADR-001 §4.1 makes client "
                    + "warnings a precondition for deleting anything — a silent expiry is exactly "
                    + "the outcome the ADR forbids.");
        }
        if (reminderDaysBefore.stream().anyMatch(d -> d == null || d < 1)) {
            throw new IllegalStateException(
                "app.retention.reminder-days-before must contain positive day counts only.");
        }
        if (maxPerRun < 1) {
            throw new IllegalStateException("app.retention.max-per-run must be at least 1.");
        }
    }
}
