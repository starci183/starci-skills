import { createHmac, timingSafeEqual } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { InjectHttpSecurityOptions } from "./http-security.decorators"
import type { HttpSecurityOptions } from "./http-security.options"

/** What a provider delivery carries for its proof. */
export interface WebhookDelivery {
    /** The provider key the app configured the secret under. */
    readonly provider: string
    /** The exact bytes of the request body, as received (never a re-serialized body). */
    readonly rawBody: Buffer | undefined
    /** The `sha256=<hex>` signature header. */
    readonly signature: string | undefined
    /** The signed timestamp header, epoch milliseconds. */
    readonly timestamp: string | undefined
}

const SIGNATURE_PREFIX = "sha256="

/** True when both hex digests have the same bytes, compared in constant time on equal-length buffers. */
const sameDigest = (given: string, expected: string): boolean => {
    const a = Buffer.from(given, "utf8")
    const b = Buffer.from(expected, "utf8")
    return a.length === b.length && timingSafeEqual(a, b)
}

@Injectable()
/**
 * The proof of a signed webhook: an HMAC-SHA256 over `<timestamp>.<raw body>` compared in constant time, and a replay
 * window on the signed timestamp. It is the only code that reads a webhook secret; a door calls `verify` first and is
 * never reached with an unproven delivery.
 */
export class WebhookSignatureService {
    constructor(
        @InjectHttpSecurityOptions() private readonly options: HttpSecurityOptions,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Throws when the delivery is not signed by the provider's secret, or was signed outside the replay window. */
    verify(delivery: WebhookDelivery): void {
        const provider = this.options.webhooks[delivery.provider]
        if (provider === undefined) {
            throw new HttpSecurityError({
                code: HttpSecurityErrorCode.WebhookProviderUnknown,
                params: { provider: delivery.provider },
            })
        }
        const signedAt = Number(delivery.timestamp)
        const { rawBody, signature } = delivery
        if (
            rawBody === undefined ||
            signature === undefined ||
            delivery.timestamp === undefined ||
            !Number.isFinite(signedAt)
        ) {
            throw new HttpSecurityError({ code: HttpSecurityErrorCode.WebhookSignatureInvalid })
        }
        const expected = createHmac("sha256", provider.secret.reveal())
            .update(`${delivery.timestamp}.`)
            .update(rawBody)
            .digest("hex")
        const given = signature.startsWith(SIGNATURE_PREFIX) ? signature.slice(SIGNATURE_PREFIX.length) : ""
        if (!sameDigest(given, expected)) {
            throw new HttpSecurityError({ code: HttpSecurityErrorCode.WebhookSignatureInvalid })
        }
        if (Math.abs(this.clock.now().getTime() - signedAt) > provider.toleranceMs) {
            throw new HttpSecurityError({ code: HttpSecurityErrorCode.WebhookReplayed })
        }
    }
}
