import { createHmac, timingSafeEqual } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { InjectHttpSecurityOptions } from "./http-security.decorators"
import type { HttpSecurityOptions } from "./http-security.options"

/** The exact signed material of one webhook delivery. */
export interface WebhookDelivery {
    /** The configured provider whose secret signs this delivery. */
    readonly provider: string
    /** The unparsed request bytes covered by the signature. */
    readonly rawBody: Buffer | undefined
    /** The provider signature header, when supplied. */
    readonly signature: string | undefined
    /** The provider timestamp header used for replay protection, when supplied. */
    readonly timestamp: string | undefined
}

const sameDigest = (given: string, expected: string): boolean => {
    const actual = Buffer.from(given, "utf8")
    const wanted = Buffer.from(expected, "utf8")
    return actual.length === wanted.length && timingSafeEqual(actual, wanted)
}

@Injectable()
/** Verifies an HMAC-SHA256 over `<timestamp>.<raw body>` and its replay window before any domain intake runs. */
export class WebhookSignatureService {
    constructor(
        @InjectHttpSecurityOptions() private readonly options: HttpSecurityOptions,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Throws unless the delivery carries a configured provider's current, constant-time-equal signature. */
    verify(delivery: WebhookDelivery): void {
        const provider = this.options.webhooks[delivery.provider]
        if (!provider) {
            throw new HttpSecurityError({
                code: HttpSecurityErrorCode.WebhookProviderUnknown,
                params: { provider: delivery.provider },
            })
        }
        const signedAt = Number(delivery.timestamp)
        if (!delivery.rawBody || !delivery.signature || !delivery.timestamp || !Number.isFinite(signedAt)) {
            throw new HttpSecurityError({
                code: HttpSecurityErrorCode.WebhookSignatureInvalid,
            })
        }
        const expected = createHmac("sha256", provider.secret.reveal())
            .update(`${delivery.timestamp}.`)
            .update(delivery.rawBody)
            .digest("hex")
        const given = delivery.signature.startsWith("sha256=") ? delivery.signature.slice("sha256=".length) : ""
        if (!sameDigest(given, expected)) {
            throw new HttpSecurityError({
                code: HttpSecurityErrorCode.WebhookSignatureInvalid,
            })
        }
        if (Math.abs(this.clock.now().getTime() - signedAt) > provider.toleranceMs) {
            throw new HttpSecurityError({
                code: HttpSecurityErrorCode.WebhookReplayed,
            })
        }
    }
}
