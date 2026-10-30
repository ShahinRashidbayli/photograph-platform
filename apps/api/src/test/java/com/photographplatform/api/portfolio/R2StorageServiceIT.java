package com.photographplatform.api.portfolio;

import com.photographplatform.api.portfolio.config.R2Config;
import com.photographplatform.api.portfolio.config.R2Properties;
import com.photographplatform.api.portfolio.service.R2StorageService;
import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the presigned upload/download flow against a real S3
 * implementation (MinIO), the way the browser actually uses it: the API only
 * ever hands out a URL, and the bytes travel over plain HTTP from a client
 * that carries no AWS credentials.
 *
 * <p>This is here because presigning has a failure mode that no unit test with
 * a mocked presigner can catch. A presigned URL is signed over the exact host
 * and path the client will request, so if the SDK addresses the bucket
 * virtual-host style ({@code bucket.host/key}) while the endpoint only serves
 * path style ({@code host/bucket/key}), presigning still succeeds, the API
 * still returns 200, and only the browser's PUT fails — with a 403 that says
 * "SignatureDoesNotMatch" and names neither the bucket nor the cause. See
 * {@link R2Properties#isPathStyle()}.
 *
 * <p>MinIO is the local stand-in for Cloudflare R2 (see
 * infra/docker-compose.yml); it needs path-style because {@code
 * bucket.localhost} does not resolve.
 */
class R2StorageServiceIT {

    private static final String ACCESS_KEY = "fotolio_test";
    private static final String SECRET_KEY = "fotolio_test_secret";
    private static final String BUCKET = "fotolio-media-test";

    /**
     * Pulled from quay.io rather than Docker Hub, for the reason
     * infra/docker-compose.yml already records: MinIO's Hub repositories
     * refuse anonymous pulls, so {@code minio/minio} fails the image fetch
     * with "pull access denied" and this class errors out before its first
     * assertion. The compose file was moved to the mirror; this test was
     * left behind on the name that no longer resolves, and nothing noticed
     * because no *IT class was reaching a runner. Same tag, same digest,
     * same MinIO — the registry is the only difference.
     */
    private static final String MINIO_IMAGE = "quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z";

    @SuppressWarnings("resource")
    private static final GenericContainer<?> MINIO =
        new GenericContainer<>(DockerImageName.parse(MINIO_IMAGE))
            .withEnv("MINIO_ROOT_USER", ACCESS_KEY)
            .withEnv("MINIO_ROOT_PASSWORD", SECRET_KEY)
            .withCommand("server", "/data")
            .withExposedPorts(9000)
            .waitingFor(Wait.forHttp("/minio/health/live").forPort(9000));

    private static R2StorageService storage;

    @BeforeAll
    static void startMinio() {
        MINIO.start();

        R2Properties props = new R2Properties();
        props.setEndpoint("http://" + MINIO.getHost() + ":" + MINIO.getMappedPort(9000));
        props.setAccessKey(ACCESS_KEY);
        props.setSecretKey(SECRET_KEY);
        props.setBucket(BUCKET);
        props.setPresignedExpiryMinutes(10);
        props.setPathStyle(true);

        // Build the clients through the real R2Config so the test covers the
        // production wiring, not a hand-rolled client that might differ.
        R2Config config = new R2Config(props);
        S3Client s3 = config.r2S3Client();
        S3Presigner presigner = config.r2S3Presigner();

        s3.createBucket(CreateBucketRequest.builder().bucket(BUCKET).build());
        storage = new R2StorageService(presigner, s3, props);
    }

    @AfterAll
    static void stopMinio() {
        MINIO.stop();
    }

    @Test
    void browserCanUploadAndFetchThroughPresignedUrls() throws IOException {
        String key = "tenant-a/photos/sample.txt";
        byte[] payload = "hello from the browser".getBytes(StandardCharsets.UTF_8);

        // 1. The API hands out an upload URL; the "browser" PUTs to it with no
        //    credentials of its own.
        String uploadUrl = storage.generateUploadUrl(key, "text/plain", payload.length);
        int uploadStatus = put(uploadUrl, "text/plain", payload);
        assertThat(uploadStatus)
            .as("presigned PUT must be accepted — a 403 here means the URL was "
                + "signed for a different host form than the one requested")
            .isEqualTo(200);

        // 2. The object is really in the bucket, readable server-side.
        assertThat(storage.downloadBytes(key)).isEqualTo(payload);

        // 3. And the view URL the gallery embeds resolves anonymously.
        String downloadUrl = storage.generateDownloadUrl(key);
        assertThat(get(downloadUrl)).isEqualTo(payload);
    }

    /**
     * The size limit has to hold at the storage layer, not in our own
     * bookkeeping, because the bytes never pass through this application: the
     * browser talks to R2 directly and the API only ever hands out a URL. So
     * the question this test answers is whether {@code contentLength} on the
     * presign really becomes part of the signature — if the SDK were to leave
     * {@code Content-Length} out of {@code X-Amz-SignedHeaders}, presigning
     * would still succeed, every upload would still work, and the limit would
     * be decorative. That failure is invisible without a real S3 on the other
     * end of the socket.
     */
    @Test
    void presignedUploadRefusesABodyLargerThanTheSignedLength() throws IOException {
        String key = "tenant-a/photos/oversized.txt";
        byte[] allowed = new byte[64];
        byte[] oversized = new byte[65];

        String uploadUrl = storage.generateUploadUrl(key, "text/plain", allowed.length);

        assertThat(put(uploadUrl, "text/plain", oversized))
            .as("a body longer than the signed Content-Length must be rejected, "
                + "or a pre-signed PUT is an unbounded write capability")
            .isEqualTo(403);

        assertThat(put(uploadUrl, "text/plain", allowed))
            .as("the size that was signed for must still upload")
            .isEqualTo(200);
    }

    @Test
    void serverSideUploadIsReadableThroughAPresignedUrl() throws IOException {
        String key = "tenant-a/photos/thumb_sample.jpg";
        byte[] payload = new byte[] {1, 2, 3, 4, 5};

        // The path ThumbnailService uses: server writes the derivative, the
        // client reads it back through a presigned URL.
        storage.uploadBytes(key, "image/jpeg", payload);

        assertThat(get(storage.generateDownloadUrl(key))).isEqualTo(payload);
    }

    private static int put(String url, String contentType, byte[] body) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
        conn.setRequestMethod("PUT");
        conn.setDoOutput(true);
        conn.setRequestProperty("Content-Type", contentType);
        try (OutputStream out = conn.getOutputStream()) {
            out.write(body);
        }
        int status = conn.getResponseCode();
        conn.disconnect();
        return status;
    }

    private static byte[] get(String url) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
        conn.setRequestMethod("GET");
        try (var in = conn.getInputStream()) {
            return in.readAllBytes();
        } finally {
            conn.disconnect();
        }
    }
}
