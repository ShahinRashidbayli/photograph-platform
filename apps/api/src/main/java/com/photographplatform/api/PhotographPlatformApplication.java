package com.photographplatform.api;

import com.photographplatform.api.notification.config.EmailProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableAsync
@EnableConfigurationProperties(EmailProperties.class)
public class PhotographPlatformApplication {

    public static void main(String[] args) {
        SpringApplication.run(PhotographPlatformApplication.class, args);
    }
}
