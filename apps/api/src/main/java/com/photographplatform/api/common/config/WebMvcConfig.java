package com.photographplatform.api.common.config;

import com.photographplatform.api.common.security.EmailVerificationInterceptor;
import com.photographplatform.api.common.security.WriteAccessInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final EmailVerificationInterceptor emailVerificationInterceptor;
    private final WriteAccessInterceptor writeAccessInterceptor;

    public WebMvcConfig(
        EmailVerificationInterceptor emailVerificationInterceptor,
        WriteAccessInterceptor writeAccessInterceptor) {
        this.emailVerificationInterceptor = emailVerificationInterceptor;
        this.writeAccessInterceptor = writeAccessInterceptor;
    }

    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(emailVerificationInterceptor);
        // After the verification gate: "verify your email" is the more
        // actionable message when an account is both unverified and lapsed.
        registry.addInterceptor(writeAccessInterceptor);
    }
}
