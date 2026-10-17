import type { EnvSource } from "@modules/platform/config"
import type { SepayOptions } from "./sepay.options"

/** Reads the SePay signing secret and replay tolerance once at the billing app root. */
export const parseSepayConfig = (env: EnvSource): SepayOptions => ({
    secret: env.secret("SEPAY_WEBHOOK_SECRET"),
    toleranceMs: env.duration("SEPAY_WEBHOOK_TOLERANCE", 300_000),
})
