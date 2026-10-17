package com.photographplatform.api.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;

class ContextPropagatingTaskDecoratorTest {

    private final AsyncConfig.ContextPropagatingTaskDecorator decorator =
        new AsyncConfig.ContextPropagatingTaskDecorator();

    @AfterEach
    void clearThread() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @Test
    void carriesTheSubmittersContextToTheWorker() throws InterruptedException {
        signIn("tenant-a", "user-a");
        AtomicReference<String> seenTenant = new AtomicReference<>();
        AtomicReference<Authentication> seenAuth = new AtomicReference<>();
        Runnable probe = decorator.decorate(() -> {
            seenTenant.set(TenantContext.getTenant());
            seenAuth.set(SecurityContextHolder.getContext().getAuthentication());
        });

        runOnNewThread(probe);

        assertThat(seenTenant.get()).isEqualTo("tenant-a");
        assertThat(seenAuth.get().getName()).isEqualTo("user-a");
    }

    @Test
    void leavesAWorkerThreadEmptyAfterwards() throws InterruptedException {
        signIn("tenant-a", "user-a");
        Runnable task = decorator.decorate(() -> { });
        AtomicReference<String> tenantAfter = new AtomicReference<>("unset");
        AtomicReference<Authentication> authAfter = new AtomicReference<>();

        runOnNewThread(() -> {
            task.run();
            tenantAfter.set(TenantContext.getTenant());
            authAfter.set(SecurityContextHolder.getContext().getAuthentication());
        });

        assertThat(tenantAfter.get()).isNull();
        assertThat(authAfter.get()).isNull();
    }

    /**
     * {@code CallerRunsPolicy}: a saturated pool runs the task on the thread
     * that submitted it. That thread is a request, and it must come out of the
     * task with its own tenant and principal still in place.
     */
    @Test
    void restoresTheCallersContextWhenTheTaskRunsOnTheSubmittingThread() {
        signIn("tenant-a", "user-a");
        MDC.put("tenant_id", "tenant-a");
        Runnable task = decorator.decorate(() -> TenantContext.setTenant("changed-inside-task"));

        task.run();

        assertThat(TenantContext.getTenant()).isEqualTo("tenant-a");
        assertThat(SecurityContextHolder.getContext().getAuthentication().getName()).isEqualTo("user-a");
        assertThat(MDC.get("tenant_id")).isEqualTo("tenant-a");
    }

    private static void signIn(String tenant, String user) {
        TenantContext.setTenant(tenant);
        SecurityContextHolder.setContext(new SecurityContextImpl(
            new UsernamePasswordAuthenticationToken(user, null, List.of())));
    }

    private static void runOnNewThread(Runnable runnable) throws InterruptedException {
        Thread thread = new Thread(runnable);
        thread.start();
        thread.join();
    }
}
