package com.photographplatform.api.common.outbox;

/**
 * Runs one kind of outbox job. Feature modules implement it; the worker finds
 * every implementation by {@link #kind()}, so {@code common} never learns what
 * the jobs are about.
 *
 * <h2>Contract</h2>
 * <ul>
 *   <li>Throwing means "try again later": the worker reschedules with backoff
 *       and marks the job {@code DEAD} after the last attempt.</li>
 *   <li>Returning means done: the row is deleted at once.</li>
 *   <li>A job can run more than once — a worker that dies between the side
 *       effect and the delete leaves it to be claimed again. A handler whose
 *       side effect must not repeat has to guard against that itself.</li>
 *   <li>It runs outside any transaction, with the job's tenant bound. A handler
 *       that reads tenant data opens its own, so RLS applies; one that only
 *       calls out holds no connection while it waits.</li>
 * </ul>
 */
public interface OutboxHandler {

    /** Stable name stored in {@code outbox_jobs.kind}; never a class name. */
    String kind();

    void handle(OutboxJob job) throws Exception;

    /**
     * What to store as {@code last_error}. The default is the exception's
     * class only: messages from providers have echoed recipients and subjects
     * back (BUG-014), and this column outlives the request by 30 days.
     */
    default String describeFailure(Exception failure) {
        return failure.getClass().getSimpleName();
    }
}
