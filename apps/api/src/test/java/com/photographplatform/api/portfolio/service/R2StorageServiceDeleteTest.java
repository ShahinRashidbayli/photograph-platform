package com.photographplatform.api.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.photographplatform.api.portfolio.config.R2Properties;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsResponse;
import software.amazon.awssdk.services.s3.model.S3Error;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

class R2StorageServiceDeleteTest {

    private final S3Client s3 = mock(S3Client.class);
    private final R2StorageService storage = new R2StorageService(mock(S3Presigner.class), s3, new R2Properties());

    /** 400 watermarked photos own 1 600 objects; one request may name at most 1 000. */
    @Test
    void splitsALargeDeleteIntoRequestsOfAtMostAThousandKeys() {
        when(s3.deleteObjects(any(DeleteObjectsRequest.class))).thenReturn(DeleteObjectsResponse.builder().build());

        storage.deleteObjects(keys(1_600));

        ArgumentCaptor<DeleteObjectsRequest> requests = ArgumentCaptor.forClass(DeleteObjectsRequest.class);
        verify(s3, times(2)).deleteObjects(requests.capture());
        assertThat(requests.getAllValues())
            .extracting(r -> r.delete().objects().size())
            .containsExactly(1_000, 600);
    }

    /**
     * Storage reports per-key failures in the response, not as an exception.
     * Ignoring them let callers that delete storage first and rows second go on
     * to delete the rows — orphaning the very objects that had failed.
     */
    @Test
    void aKeyStorageCouldNotDeleteFailsTheCall() {
        when(s3.deleteObjects(any(DeleteObjectsRequest.class))).thenReturn(DeleteObjectsResponse.builder()
            .errors(S3Error.builder().key("t/g/a.jpg").code("AccessDenied").build())
            .build());

        assertThatThrownBy(() -> storage.deleteObjects(List.of("t/g/a.jpg", "t/g/b.jpg")))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("t/g/a.jpg (AccessDenied)");
    }

    @Test
    void ignoresAbsentKeysAndSendsNothingWhenNoneAreLeft() {
        storage.deleteObjects(Arrays.asList(null, "", " "));

        verify(s3, never()).deleteObjects(any(DeleteObjectsRequest.class));
    }

    private static List<String> keys(int count) {
        return new ArrayList<>(IntStream.range(0, count).mapToObj(i -> "t/g/photo-" + i + ".jpg").toList());
    }
}
