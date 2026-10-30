package com.photographplatform.api.common.security;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The originating client IP, as far as it can be trusted.
 *
 * <h2>Why this no longer reads proxy headers itself</h2>
 * It used to take the leftmost value of {@code X-Forwarded-For}, with no check
 * on who put it there. {@code X-Forwarded-For} is a request header: anyone can
 * send one. A proxy <em>appends</em> the peer it saw, so the leftmost entry is
 * whatever the client typed — which meant the caller chose their own identity
 * for every IP-keyed decision in the application.
 *
 * <p>That silently disabled the registration limit (5/hour/IP), the login
 * lockout (20 failures/IP), the public lead-form limit (3/5min) and the
 * magic-link IP limit: rotate the header, get a fresh bucket. It also made
 * {@code audit_log.ip_address} attacker-controlled, so the one record you would
 * reach for during an incident was the one that could not be believed.
 *
 * <p>The fix is not to parse the header more cleverly here — it is to know
 * which hops are ours. Tomcat's {@code RemoteIpValve} does exactly that, and is
 * enabled by {@code server.forward-headers-strategy: native}: it walks
 * {@code X-Forwarded-For} from the right, discarding entries that match
 * {@code server.tomcat.remoteip.internal-proxies}, and stops at the first
 * address that is not one of our own proxies. Anything the client prepended is
 * to the <em>left</em> of that and is never reached.
 *
 * <p>So by the time a request arrives here, {@code getRemoteAddr()} is already
 * the right answer: the real peer when nothing is in front of us, and the real
 * client when our proxy is. Trust is a deployment fact, and it now lives in
 * deployment configuration rather than in this method's optimism.
 *
 * <p>Kept as a named seam rather than inlining {@code getRemoteAddr()} at 35
 * call sites, so there stays exactly one place to change if the topology does.
 */
public final class ClientIp {

    private ClientIp() {
    }

    public static String from(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}
