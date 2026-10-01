/** Log events of the http-security capability. */
export enum HttpSecurityLogEvent {
    /** The shared rate-limit store failed; the limiter counts in process (per replica) until it answers again, logged once per window. */
    RateLimitStoreDegraded = "rate-limit.store.degraded",
}
