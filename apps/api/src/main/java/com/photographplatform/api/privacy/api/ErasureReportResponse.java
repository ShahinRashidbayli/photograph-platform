package com.photographplatform.api.privacy.api;

import com.photographplatform.api.common.privacy.ErasureOutcome;
import com.photographplatform.api.common.privacy.RetentionBasis;
import java.util.List;

/**
 * What an erasure did — or, for a preview, would do.
 *
 * @param executed false for a preview, which changed nothing
 * @param items    one line per kind of record, in the order the studio's data
 *                 is erased; kinds with nothing found are left out
 */
public record ErasureReportResponse(boolean executed, List<Item> items) {

    public record Item(String category, int deleted, int anonymized, int retained, RetentionBasis retentionBasis) {
    }

    static ErasureReportResponse of(boolean executed, List<ErasureOutcome> outcomes) {
        return new ErasureReportResponse(executed, outcomes.stream()
            .filter(ErasureOutcome::touchedAnything)
            .map(o -> new Item(o.category(), o.deleted(), o.anonymized(), o.retained(), o.basis()))
            .toList());
    }
}
