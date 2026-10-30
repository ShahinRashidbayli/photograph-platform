package com.photographplatform.api.common;

import com.photographplatform.api.common.util.Paging;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The bound on caller-supplied paging.
 *
 * <p>The behaviour worth pinning is that an oversized {@code size} is
 * <em>refused</em> and not quietly reduced. The clients here page by asking for
 * N rows and stopping when fewer than N come back, so serving 200 to a caller
 * that asked for 500 would read as "that was the last page" and silently drop
 * everything after it.
 */
class PagingTest {

    private static final Sort UNSORTED = Sort.unsorted();

    @Test
    void acceptsTheLargestPageAnyClientAsksFor() {
        // useBookings.ts and the gallery booking picker both ask for 100.
        assertThat(Paging.of(0, 100, UNSORTED).getPageSize()).isEqualTo(100);
        assertThat(Paging.of(3, Paging.MAX_PAGE_SIZE, UNSORTED).getPageNumber()).isEqualTo(3);
    }

    @Test
    void refusesAnOversizedPageRatherThanClampingIt() {
        assertThatThrownBy(() -> Paging.of(0, Paging.MAX_PAGE_SIZE + 1, UNSORTED))
            .isInstanceOf(IllegalArgumentException.class)
            // The limit is named, so the caller can act on the answer.
            .hasMessageContaining(String.valueOf(Paging.MAX_PAGE_SIZE));
    }

    @Test
    void refusesNonsensePagingBeforeItReachesTheDatabase() {
        assertThatThrownBy(() -> Paging.of(-1, 20, UNSORTED))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Paging.of(0, 0, UNSORTED))
            .isInstanceOf(IllegalArgumentException.class);
    }
}
