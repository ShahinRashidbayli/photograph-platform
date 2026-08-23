package com.photographplatform.api.portfolio.service;

import com.photographplatform.api.portfolio.config.R2Properties;
import java.io.InputStream;
import java.time.Duration;
import java.util.List;
import java.util.Objects;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Service
@ConditionalOnProperty(name = "app.r2.endpoint")
public class R2StorageService {

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
     */
    public void deleteObjects(List<String> r2Keys) {
        List<ObjectIdentifier> ids = r2Keys.stream()
            .filter(Objects::nonNull)
            .filter(k -> !k.isBlank())
            .map(k -> ObjectIdentifier.builder().key(k).build())
            .toList();
        if (ids.isEmpty()) {
            return;
        }
        s3Client.deleteObjects(DeleteObjectsRequest.builder()
            .bucket(props.getBucket())
            .delete(Delete.builder().objects(ids).build())
            .build());
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
            .build();
        s3Client.putObject(putRequest, RequestBody.fromBytes(bytes));
    }
}
