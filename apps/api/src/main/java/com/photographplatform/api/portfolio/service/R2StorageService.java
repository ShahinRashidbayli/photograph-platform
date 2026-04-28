package com.photographplatform.api.portfolio.service;

import com.photographplatform.api.portfolio.config.R2Properties;
import java.time.Duration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Service
@ConditionalOnProperty(name = "app.r2.endpoint")
public class R2StorageService {

    private final S3Presigner presigner;
    private final R2Properties props;

    public R2StorageService(S3Presigner r2S3Presigner, R2Properties props) {
        this.presigner = r2S3Presigner;
        this.props = props;
    }

    /**
     * Generates a pre-signed PUT URL allowing the client to upload directly to R2.
     *
     * @param r2Key       object key inside the bucket (e.g. "tenantId/photos/uuid.jpg")
     * @param contentType MIME type declared by the uploader
     * @return pre-signed URL string
     */
    public String generateUploadUrl(String r2Key, String contentType) {
        PutObjectRequest putRequest = PutObjectRequest.builder()
            .bucket(props.getBucket())
            .key(r2Key)
            .contentType(contentType)
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
}
