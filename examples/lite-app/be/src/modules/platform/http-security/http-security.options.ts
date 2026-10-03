import type { Secret } from "@modules/platform/config"

/** How many requests a caller may send per window, per tier. */
export interface RateLimitOptions {
    /** The length of one window in milliseconds. */
    readonly windowMs: number
    /** Requests per window for the default tier. */
    readonly defaultLimit: number
    /** Requests per window for the strict tier (authentication handshakes and signed webhooks). */
    readonly strictLimit: number
}

/** The signing proof configured for one webhook provider. */
export interface WebhookProviderOptions {
    /** The secret the provider signs deliveries with. */
    readonly secret: Secret
    /** The maximum age or clock skew of one delivery, in milliseconds. */
    readonly toleranceMs: number
}

/** Options of the http-security capability. */
export interface HttpSecurityOptions {
    /** The origins allowed to send state-changing requests from a browser. */
    readonly allowedOrigins: ReadonlyArray<string>
    /** The rate limit tiers. */
    readonly rateLimit: RateLimitOptions
    /** Signed-webhook providers keyed by their generated route name. */
    readonly webhooks: Readonly<Record<string, WebhookProviderOptions>>
}
