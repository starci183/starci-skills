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

/** What the signature proof of one webhook provider needs. */
export interface WebhookProviderOptions {
    /** The secret the provider signs its deliveries with. */
    readonly secret: Secret
    /** How far a delivery's signed timestamp may be from now, in milliseconds (the replay window). */
    readonly toleranceMs: number
}

/** Options of the http-security capability. */
export interface HttpSecurityOptions {
    /** The origins allowed to send state-changing requests from a browser. */
    readonly allowedOrigins: ReadonlyArray<string>
    /** The rate limit tiers. */
    readonly rateLimit: RateLimitOptions
    /** The webhook providers the app receives, by provider key; `{}` for an app that serves no webhook. */
    readonly webhooks: Readonly<Record<string, WebhookProviderOptions>>
}
