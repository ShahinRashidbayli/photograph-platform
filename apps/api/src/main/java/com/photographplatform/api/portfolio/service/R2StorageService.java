package com.photographplatform.api.portfolio.service;

import com.photographplatform.api.portfolio.config.R2Properties;
import java.io.InputStream;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.awscore.AwsRequestOverrideConfiguration;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsResponse;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Service
@ConditionalOnProperty(name = "app.r2.endpoint")
public class R2StorageService {

    /** The most keys one {@code DeleteObjects} request accepts (S3 API limit, honoured by R2). */
    static final int MAX_KEYS_PER_DELETE = 1000;

    /**
     * Budgets for the calls that read or write a whole object at once.
     *
     * <h2>Why these exist</h2>
     * The S3 client is built with the SDK's defaults, which for the sync
     * client means a 30-second socket timeout and up to three attempts — over
     * a minute and a half before a call gives up, and only if the socket goes
     * quiet rather than merely slow.
     *
     * <p>That would be survivable if these calls were isolated, and they are
     * not. {@code InvoiceService} uploads the rendered PDF <em>while holding
     * the {@code invoice_counters} row lock</em> that its gap-free numbering
     * depends on: that lock is taken by the allocating {@code INSERT .. ON
     * CONFLICT} and released only at commit, so every concurrent invoice for
     * that tenant queues behind this upload, and an R2 stall stops the studio
     * issuing invoices at all. {@code GalleryRetentionService} deletes objects
     * inside its per-tenant transaction for the same reason. Both also hold a
     * connection out of a pool of ten (see {@code spring.datasource.hikari}),
     * whose own acquisition timeout is five seconds — so a slow object store
     * does not degrade uploads, it exhausts the pool and takes unrelated
     * requests down with it. This is the same reasoning {@code StripeConfig}
     * spells out for the payment client, and it applies here for the same
     * reason.
     *
     * <p>So: fail in seconds, not minutes. The attempt timeout is what a single
     * try gets; the call timeout bounds the whole thing including the SDK's
     * retry, which is what actually caps how long a lock can be held.
     */
    private static final AwsRequestOverrideConfiguration SMALL_OBJECT_BUDGET =
        AwsRequestOverrideConfiguration.builder()
            .apiCallAttemptTimeout(Duration.ofSeconds(10))
            .apiCallTimeout(Duration.ofSeconds(20))
            .build();

    /**
     * The same, for the one bounded call that can legitimately move tens of
     * megabytes: reading a camera original back for thumbnailing, capped at
     * {@code app.r2.max-upload-bytes} (50 MB). Generous enough that a slow but
     * working link finishes, finite so a dead one does not pin an {@code
     * @Async} worker forever.
     */
    private static final AwsRequestOverrideConfiguration LARGE_OBJECT_BUDGET =
        AwsRequestOverrideConfiguration.builder()
            .apiCallAttemptTimeout(Duration.ofSeconds(30))
            .apiCallTimeout(Duration.ofSeconds(60))
            .build();

    private final S3Presigner presigner;
    private final S3Client s3Client;
    private final R2Properties props;

    public R2StorageService(S3Presigner r2S3Presigner, S3Client r2S3Client, R2Properties props) {
        this.presigner = r2S3Presigner;
        this.s3Client = r2S3Client;
        this.props = props;
    }

    /**
     * Generates a pre-signed PUT URL allowing the client to upload directly to R2.
     *
     * <h2>Why the length is a parameter and not optional</h2>
     * A pre-signed PUT is a bearer capability to write one object, and by
     * default it is unbounded — the holder can push a terabyte through it. This
     * signature used to take only the key and the type, so nothing in the
     * system limited how much any one account could store; the per-plan
     * fair-use figure is advertised to the frontend and enforced nowhere.
     *
     * <p>Setting {@code contentLength} puts {@code Content-Length} among the
     * headers SigV4 signs, which changes it from something the client reports
     * afterwards into a term of the signature: an upload whose actual body
     * length differs from the signed value is rejected by object storage with a
     * signature error, before any bytes are stored. The caller must therefore
     * have decided the size up front — which is why {@code InitiateUploadRequest}
     * requires it and why the size persisted against the photo is taken from
     * there rather than from a second, unverifiable claim at complete-time.
     *
     * <p>It is a required parameter rather than an overload precisely because
     * an unbounded variant left reachable is the bug: the next upload path
     * added would silently get the old behaviour.
     *
     * @param r2Key         object key inside the bucket (e.g. "tenantId/photos/uuid.jpg")
     * @param contentType   MIME type the object will be stored and served with; callers
     *                      must resolve this through {@code ImageUploadType} rather than
     *                      passing a client-supplied string through
     * @param contentLength exact size in bytes the upload is permitted to be
     * @return pre-signed URL string
     */
    public String generateUploadUrl(String r2Key, String contentType, long contentLength) {
        PutObjectRequest putRequest = PutObjectRequest.builder()
            .bucket(props.getBucket())
            .key(r2Key)
            .contentType(contentType)
            .contentLength(contentLength)
            .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
            .signatureDuration(Duration.ofMinutes(props.getPresignedExpiryMinutes()))
            .putObjectRequest(putRequest)
            .build();

        PresignedPutObjectRequest presigned = presigner.presignPutObject(presignRequest);
        return presigned.url().toString();
    }

    /**
     * Generates a pre-signed GET URL allowing the client to download/view an object.
     *
     * @param r2Key object key inside the bucket
     * @return pre-signed URL string
     */
    public String generateDownloadUrl(String r2Key) {
        software.amazon.awssdk.services.s3.model.GetObjectRequest getRequest =
            software.amazon.awssdk.services.s3.model.GetObjectRequest.builder()
                .bucket(props.getBucket())
                .key(r2Key)
                .build();

        software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest presignRequest =
            software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(props.getPresignedExpiryMinutes()))
                .getObjectRequest(getRequest)
                .build();

        return presigner.presignGetObject(presignRequest).url().toString();
    }

    /**
     * Server-side download of an object's bytes. Used by ThumbnailService to
     * read the original after the client's direct PUT to R2. Avoid for large
     * objects — the whole payload lands in heap.
     */
    public byte[] downloadBytes(String r2Key) {
        software.amazon.awssdk.services.s3.model.GetObjectRequest getRequest =
            software.amazon.awssdk.services.s3.model.GetObjectRequest.builder()
                .bucket(props.getBucket())
                .key(r2Key)
                .overrideConfiguration(LARGE_OBJECT_BUDGET)
                .build();
        ResponseBytes<GetObjectResponse> resp = s3Client.getObjectAsBytes(getRequest);
        return resp.asByteArray();
    }

    /**
     * Opens an object for streaming.
     *
     * <p>Unlike {@link #downloadBytes(String)} this never materialises the
     * object in heap, which is what makes a gallery ZIP possible: a 400-photo
     * wedding delivery is several gigabytes, and buffering even one photo per
     * request across a few concurrent downloads is enough to take the
     * container down. The caller owns the stream and must close it.
     */
    public InputStream openStream(String r2Key) {
        // Deliberately without a call budget, unlike every other method here.
        // An api-call timeout covers the time spent reading the response
        // stream, and this stream is read for as long as the client's ZIP
        // takes to download — minutes, legitimately. Bounding it would abort
        // exactly the transfers it is meant to protect. Nothing is at risk
        // either: this path holds no lock and no database connection (see
        // GalleryService#prepareDownload, which returns keys and streams
        // afterwards, outside any transaction) — only one of the sixteen
        // threads WebAsyncConfig sizes for precisely this.
        software.amazon.awssdk.services.s3.model.GetObjectRequest getRequest =
            software.amazon.awssdk.services.s3.model.GetObjectRequest.builder()
                .bucket(props.getBucket())
                .key(r2Key)
                .build();
        return s3Client.getObject(getRequest);
    }

    /**
     * Removes objects from the bucket, ignoring any that are already gone.
     *
     * <p>Null and blank keys are filtered out rather than rejected: callers
     * delete a photo's whole derivative set at once (original, thumbnail,
     * watermark) and some of those are legitimately absent — a photo deleted
     * before processing finished never had a thumbnail.
     *
     * <h2>Batches, and failures that do not throw</h2>
     * {@code DeleteObjects} takes at most {@value #MAX_KEYS_PER_DELETE} keys
     * per request. A 400-photo watermarked gallery owns 1 600, and sending them
     * in one call made the whole request fail — every night, for the retention
     * purge of exactly the galleries that cost the most to keep.
     *
     * <p>It also reports per-key failures in the response body rather than as
     * an exception. Those used to be ignored, so a key that could not be
     * deleted looked deleted: callers that remove storage first and rows second
     * — the order that is supposed to make a failure retryable — went on to
     * delete the rows anyway, and the object was orphaned for good. Any
     * per-key error now throws.
     *
     * @throws IllegalStateException if storage reports any key as not deleted
     */
    public void deleteObjects(List<String> r2Keys) {
        List<ObjectIdentifier> ids = r2Keys.stream()
            .filter(Objects::nonNull)
            .filter(k -> !k.isBlank())
            .distinct()
            .map(k -> ObjectIdentifier.builder().key(k).build())
            .toList();
        List<String> failed = new ArrayList<>();
        for (int from = 0; from < ids.size(); from += MAX_KEYS_PER_DELETE) {
            List<ObjectIdentifier> batch = ids.subList(from, Math.min(from + MAX_KEYS_PER_DELETE, ids.size()));
            DeleteObjectsResponse response = s3Client.deleteObjects(DeleteObjectsRequest.builder()
                .bucket(props.getBucket())
                .delete(Delete.builder().objects(batch).quiet(true).build())
                // Runs inside the retention job's per-tenant transaction.
                .overrideConfiguration(SMALL_OBJECT_BUDGET)
                .build());
            response.errors().forEach(error -> failed.add(error.key() + " (" + error.code() + ")"));
        }
        if (!failed.isEmpty()) {
            throw new IllegalStateException(
                "Object storage refused to delete " + failed.size() + " of " + ids.size() + " keys: " + failed);
        }
    }

    /**
     * Server-side upload of a byte array. Used by ThumbnailService to write the
     * generated thumbnail back to R2.
     */
    public void uploadBytes(String r2Key, String contentType, byte[] bytes) {
        PutObjectRequest putRequest = PutObjectRequest.builder()
            .bucket(props.getBucket())
            .key(r2Key)
            .contentType(contentType)
            .contentLength((long) bytes.length)
            // Runs under the invoice_counters row lock on the invoice path.
            .overrideConfiguration(SMALL_OBJECT_BUDGET)
            .build();
        s3Client.putObject(putRequest, RequestBody.fromBytes(bytes));
    }
}
