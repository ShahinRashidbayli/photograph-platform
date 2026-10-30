package com.photographplatform.api.billing;

import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Builds genuinely signed Stripe webhook payloads.
 *
 * <p>Signing for real rather than mocking {@code Webhook.constructEvent} is
 * deliberate: the signature check <em>is</em> this endpoint's authentication —
 * it is public and unauthenticated otherwise — so a test that stubs it past
 * proves nothing about the one control protecting it.
 */
final class StripeEventFixture {

    private StripeEventFixture() {
    }

    /**
     * The {@code Stripe-Signature} header for a payload.
     *
     * <p>Stripe signs {@code "<timestamp>.<payload>"} with HMAC-SHA256 and
     * rejects timestamps outside a 300-second tolerance, so the timestamp has
     * to be current rather than fixed.
     */
    static String signature(String payload, String secret) {
        long timestamp = System.currentTimeMillis() / 1000;
        return "t=" + timestamp + ",v1=" + hmacSha256(timestamp + "." + payload, secret);
    }

    private static String hmacSha256(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Could not sign the test payload", e);
        }
    }

    /**
     * A {@code customer.subscription.*} event.
     *
     * <p>The {@code api_version} is deliberately not the SDK's own. That makes
     * {@code getDataObjectDeserializer().getObject()} return empty and forces
     * the {@code deserializeUnsafe()} fallback — which is the path a real
     * Stripe account pinned to a different API version takes, and the one that
     * silently returned null before that fallback existed.
     */
    static String subscriptionEvent(
        String eventId, String type, String subscriptionId, String customerId,
        String tenantId, String priceId, String status, long currentPeriodEnd) {

        String metadata = tenantId == null ? "{}" : "{\"tenant_id\":\"" + tenantId + "\"}";
        String items = priceId == null
            ? "{\"object\":\"list\",\"data\":[]}"
            : """
              {"object":"list","data":[{
                 "id":"si_test","object":"subscription_item",
                 "current_period_end":%d,
                 "price":{"id":"%s","object":"price"}
              }]}""".formatted(currentPeriodEnd, priceId);

        return """
            {"id":"%s","object":"event","api_version":"2019-05-16","type":"%s",
             "data":{"object":{
                "id":"%s","object":"subscription","customer":"%s",
                "status":"%s","metadata":%s,"items":%s
             }}}""".formatted(eventId, type, subscriptionId, customerId, status, metadata, items);
    }
}
