import type { EnvSource } from "@modules/platform/config"
import type { WebhookProviderOptions } from "@modules/platform/http-security"

/** Reads the SePay signing secret and replay tolerance once at the billing app root. */
export const parseSepayConfig = (env: EnvSource): WebhookProviderOptions => ({
    secret: env.secret("SEPAY_WEBHOOK_SECRET"),
    toleranceMs: env.duration("SEPAY_WEBHOOK_TOLERANCE", 300_000),
})
