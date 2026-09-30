import type { EnvSource } from "@modules/platform/config"
import type { SepayOptions } from "./sepay.options"

/** Reads the SePay options: the URL and both secrets are required with no default, the timeout is a tunable with a literal default. */
export const parseSepayConfig = (env: EnvSource): SepayOptions => ({
    baseUrl: env.url("SEPAY_BASE_URL"),
    apiKey: env.secret("SEPAY_API_KEY"),
    webhookSecret: env.secret("SEPAY_WEBHOOK_SECRET"),
    timeoutMs: env.duration("SEPAY_TIMEOUT", 15_000),
})
