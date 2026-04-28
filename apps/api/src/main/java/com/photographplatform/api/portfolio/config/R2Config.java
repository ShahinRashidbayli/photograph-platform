package com.photographplatform.api.portfolio.config;

import java.net.URI;
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

    private final R2Properties props;

    public R2Config(R2Properties props) {
        this.props = props;
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
