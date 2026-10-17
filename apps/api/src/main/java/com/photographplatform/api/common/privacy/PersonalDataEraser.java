package com.photographplatform.api.common.privacy;

import java.util.List;

/**
 * One module's part in erasing a person's data from a studio (Art. 17 GDPR).
 *
 * <h2>Why every module erases its own data</h2>
 * A person's data is spread over eight modules — their account, the client
 * directory, leads, inquiries, bookings, galleries, contracts, invoices — and
 * no module may touch another's tables. So erasure is not a service that
 * reaches into all of them; it is this interface, implemented next to the data
 * by the module that owns it, and run in sequence by the privacy module.
 * A module added later joins erasure by implementing it, without the privacy
 * module learning it exists.
 *
 * <h2>Two passes</h2>
 * All implementations run {@link #identify} first, in {@code @Order}, then all
 * run {@link #erase}. The first pass exists because modules know a person by
 * different keys: an inquiry names a customer account, a gallery names a
 * booking, and only the email is known at the start. Each module adds the keys
 * it can resolve to the {@link ErasureSubject}, so later modules can find
 * their rows from it. Resolving every key before anything is changed means no
 * module ever looks for a person by a link an earlier one has just removed.
 *
 * <h2>Contract</h2>
 * Both methods run inside the caller's transaction — a preview is the same
 * code with the transaction rolled back, so an implementation must not commit,
 * call out to anything that cannot be rolled back, or act on storage before
 * commit. Rows that the law requires keeping are reported as retained rather
 * than touched; see {@link RetentionBasis}.
 */
public interface PersonalDataEraser {

    /** Adds the keys this module knows the subject by. Most modules need none. */
    default void identify(ErasureSubject subject) {
    }

    /** Erases, anonymises or keeps this module's rows for the subject, and says which. */
    List<ErasureOutcome> erase(ErasureSubject subject);
}
