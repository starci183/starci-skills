import { createHash, timingSafeEqual } from "node:crypto"
import type { Secret } from "@modules/platform/config"
import type { PresentedAuthorization } from "./sepay.contracts"

const digestOf = (value: string): Buffer => createHash("sha256").update(value).digest()

/**
 * True when the Authorization header of a webhook delivery is exactly `Bearer <secret>`. Both sides are hashed first, so
 * the comparison takes the same time for any length, then compared with `timingSafeEqual`.
 */
export const isWebhookAuthorized = (presented: PresentedAuthorization, secret: Secret): boolean => {
    if (presented === undefined) return false
    return timingSafeEqual(digestOf(presented), digestOf(`Bearer ${secret.reveal()}`))
}
