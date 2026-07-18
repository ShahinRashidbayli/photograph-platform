package com.photographplatform.api.portfolio.config;

import jakarta.annotation.PostConstruct;
import java.net.URI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
@ConditionalOnProperty(name = "app.r2.endpoint")
public class R2Config {

    private static final Logger LOG = LoggerFactory.getLogger(R2Config.class);
    private static final String PLACEHOLDER_CREDENTIAL = "placeholder";

    private final R2Properties props;

    public R2Config(R2Properties props) {
        this.props = props;
    }

    /**
     * Fail fast on a half-configured object store instead of booting into
     * runtime upload failures. The endpoint carries a placeholder default, so
     * this config is always active; that means a production deploy that sets
     * R2_ENDPOINT but forgets the keys would otherwise start clean and only
     * break when a photographer tries to upload.
     *
     * <p>All placeholders = R2 simply isn't configured (local dev) → warn and
     * carry on. A real endpoint with placeholder keys = a misconfigured deploy
     * → refuse to start.
     */
    @PostConstruct
    void validateCredentials() {
        boolean keysArePlaceholders = PLACEHOLDER_CREDENTIAL.equals(props.getAccessKey())
            || PLACEHOLDER_CREDENTIAL.equals(props.getSecretKey());
        if (!keysArePlaceholders) {
            return;
        }
        boolean endpointIsPlaceholder = props.getEndpoint() == null
            || props.getEndpoint().contains(PLACEHOLDER_CREDENTIAL);
        if (endpointIsPlaceholder) {
            LOG.warn("R2 object store is not configured (placeholder credentials). Media uploads "
                + "and gallery delivery will not work until R2_ENDPOINT, R2_ACCESS_KEY and "
                + "R2_SECRET_KEY are set.");
            return;
        }
        throw new IllegalStateException("R2_ENDPOINT is set to '" + props.getEndpoint()
            + "' but R2_ACCESS_KEY / R2_SECRET_KEY are still placeholders. Refusing to start "
            + "with a half-configured object store.");
    }

    @Bean
    public S3Client r2S3Client() {
        return S3Client.builder()
            .endpointOverride(URI.create(props.getEndpoint()))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(props.getAccessKey(), props.getSecretKey())
            ))
            .region(Region.of("auto"))
            .build();
    }

    @Bean
    public S3Presigner r2S3Presigner() {
        return S3Presigner.builder()
            .endpointOverride(URI.create(props.getEndpoint()))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(props.getAccessKey(), props.getSecretKey())
            ))
            .region(Region.of("auto"))
            .build();
    }
}
