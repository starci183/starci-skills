import { createHmac } from "node:crypto"
import { FakeClock, builder } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { HTTP_SECURITY_OPTIONS } from "./http-security.decorators"
import type { HttpSecurityOptions } from "./http-security.options"
import { WebhookSignatureService } from "./webhook-signature.service"

const NOW = "2026-10-02T03:00:00.000Z"
const SECRET = "gateway-secret"
const BODY = Buffer.from(JSON.stringify({ eventId: "evt-1", status: "confirmed" }))

const OPTIONS: HttpSecurityOptions = {
    allowedOrigins: [],
    rateLimit: { windowMs: 60_000, defaultLimit: 600, strictLimit: 30 },
    webhooks: { "payment-gateway": { secret: new Secret(SECRET), toleranceMs: 300_000 } },
}

/** The `sha256=<hex>` header of a delivery signed at `timestamp` with `secret`. */
const sign = (timestamp: string, body: Buffer, secret = SECRET): string =>
    `sha256=${createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex")}`

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebhookSignatureService,
            { provide: HTTP_SECURITY_OPTIONS, useValue: builder<HttpSecurityOptions>(OPTIONS)() },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return moduleRef.get(WebhookSignatureService)
}

const refusalOf = (action: () => void): unknown => {
    try {
        action()
    } catch (error) {
        return error instanceof HttpSecurityError ? error.code : error
    }
    return undefined
}

describe("WebhookSignatureService", () => {
    describe("verify", () => {
        it("accepts a delivery signed with the provider secret inside the replay window", async () => {
            const service = await build()
            const timestamp = String(Date.parse(NOW) - 60_000)

            const refusal = refusalOf(() =>
                service.verify({
                    provider: "payment-gateway",
                    rawBody: BODY,
                    signature: sign(timestamp, BODY),
                    timestamp,
                }),
            )

            expect(refusal).toBeUndefined()
        })

        it("refuses a body that differs from the one that was signed", async () => {
            const service = await build()
            const timestamp = String(Date.parse(NOW))

            const refusal = refusalOf(() =>
                service.verify({
                    provider: "payment-gateway",
                    rawBody: Buffer.from("{}"),
                    signature: sign(timestamp, BODY),
                    timestamp,
                }),
            )

            expect(refusal).toBe(HttpSecurityErrorCode.WebhookSignatureInvalid)
        })

        it("refuses a delivery signed with another secret", async () => {
            const service = await build()
            const timestamp = String(Date.parse(NOW))

            const refusal = refusalOf(() =>
                service.verify({
                    provider: "payment-gateway",
                    rawBody: BODY,
                    signature: sign(timestamp, BODY, "other-secret"),
                    timestamp,
                }),
            )

            expect(refusal).toBe(HttpSecurityErrorCode.WebhookSignatureInvalid)
        })

        it("refuses a signature without the sha256 prefix and a signature of the wrong length", async () => {
            const service = await build()
            const timestamp = String(Date.parse(NOW))
            const bare = sign(timestamp, BODY).slice("sha256=".length)

            expect(
                refusalOf(() =>
                    service.verify({ provider: "payment-gateway", rawBody: BODY, signature: bare, timestamp }),
                ),
            ).toBe(HttpSecurityErrorCode.WebhookSignatureInvalid)
            expect(
                refusalOf(() =>
                    service.verify({ provider: "payment-gateway", rawBody: BODY, signature: "sha256=ab", timestamp }),
                ),
            ).toBe(HttpSecurityErrorCode.WebhookSignatureInvalid)
        })

        it("refuses a delivery that lacks the body, the signature, the timestamp or a numeric timestamp", async () => {
            const service = await build()
            const timestamp = String(Date.parse(NOW))
            const signature = sign(timestamp, BODY)
            const invalid = HttpSecurityErrorCode.WebhookSignatureInvalid

            expect(
                refusalOf(() =>
                    service.verify({ provider: "payment-gateway", rawBody: undefined, signature, timestamp }),
                ),
            ).toBe(invalid)
            expect(
                refusalOf(() =>
                    service.verify({ provider: "payment-gateway", rawBody: BODY, signature: undefined, timestamp }),
                ),
            ).toBe(invalid)
            expect(
                refusalOf(() =>
                    service.verify({ provider: "payment-gateway", rawBody: BODY, signature, timestamp: undefined }),
                ),
            ).toBe(invalid)
            expect(
                refusalOf(() =>
                    service.verify({ provider: "payment-gateway", rawBody: BODY, signature, timestamp: "yesterday" }),
                ),
            ).toBe(invalid)
        })

        it("refuses a correctly signed delivery whose timestamp is older or newer than the replay window", async () => {
            const service = await build()
            const stale = String(Date.parse(NOW) - 300_001)
            const early = String(Date.parse(NOW) + 300_001)

            expect(
                refusalOf(() =>
                    service.verify({
                        provider: "payment-gateway",
                        rawBody: BODY,
                        signature: sign(stale, BODY),
                        timestamp: stale,
                    }),
                ),
            ).toBe(HttpSecurityErrorCode.WebhookReplayed)
            expect(
                refusalOf(() =>
                    service.verify({
                        provider: "payment-gateway",
                        rawBody: BODY,
                        signature: sign(early, BODY),
                        timestamp: early,
                    }),
                ),
            ).toBe(HttpSecurityErrorCode.WebhookReplayed)
        })

        it("refuses a provider the app did not configure", async () => {
            const service = await build()
            const timestamp = String(Date.parse(NOW))

            const refusal = refusalOf(() =>
                service.verify({ provider: "unknown", rawBody: BODY, signature: sign(timestamp, BODY), timestamp }),
            )

            expect(refusal).toBe(HttpSecurityErrorCode.WebhookProviderUnknown)
        })
    })
})
