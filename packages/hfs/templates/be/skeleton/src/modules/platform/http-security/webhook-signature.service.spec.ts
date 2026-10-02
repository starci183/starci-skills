import { createHmac } from "node:crypto"
import { Test } from "@nestjs/testing"
import { FakeClock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { HttpSecurityErrorCode } from "./errors/http-security.error"
import { HTTP_SECURITY_OPTIONS } from "./http-security.decorators"
import type { HttpSecurityOptions } from "./http-security.options"
import { WebhookSignatureService } from "./webhook-signature.service"

const NOW = "2026-01-01T00:00:00.000Z"
const SIGNED_AT = Date.parse(NOW)
const SECRET = "whsec_fixture"
const BODY = Buffer.from('{"id":"evt_1"}')

const options: HttpSecurityOptions = {
    allowedOrigins: [],
    rateLimit: { windowMs: 60_000, defaultLimit: 100, strictLimit: 10 },
    webhooks: { payments: { secret: new Secret(SECRET), toleranceMs: 300_000 } },
}

const sign = (timestamp: string, body: Buffer = BODY, secret = SECRET): string =>
    createHmac("sha256", secret).update(`${timestamp}.`).update(body).digest("hex")

const build = async () => {
    const clock = new FakeClock(NOW)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WebhookSignatureService,
            { provide: CLOCK, useValue: clock },
            { provide: HTTP_SECURITY_OPTIONS, useValue: options },
        ],
    }).compile()
    return { service: moduleRef.get(WebhookSignatureService), clock }
}

const refusal = (code: HttpSecurityErrorCode) => expect.objectContaining({ code })

describe("WebhookSignatureService", () => {
    describe("verify", () => {
        it("accepts a current delivery signed with the configured secret", async () => {
            const { service } = await build()
            const timestamp = String(SIGNED_AT)

            expect(() =>
                service.verify({ provider: "payments", rawBody: BODY, signature: `sha256=${sign(timestamp)}`, timestamp }),
            ).not.toThrow()
        })

        it("refuses a provider that is not configured", async () => {
            const { service } = await build()

            expect(() => service.verify({ provider: "unknown", rawBody: BODY, signature: "sha256=x", timestamp: "1" })).toThrow(
                refusal(HttpSecurityErrorCode.WebhookProviderUnknown),
            )
        })

        it.each([
            { rawBody: undefined, signature: "sha256=x", timestamp: String(SIGNED_AT) },
            { rawBody: BODY, signature: undefined, timestamp: String(SIGNED_AT) },
            { rawBody: BODY, signature: "sha256=x", timestamp: undefined },
            { rawBody: BODY, signature: "sha256=x", timestamp: "yesterday" },
        ])("refuses a delivery missing a signed part (%#)", async (part) => {
            const { service } = await build()

            expect(() => service.verify({ provider: "payments", ...part })).toThrow(
                refusal(HttpSecurityErrorCode.WebhookSignatureInvalid),
            )
        })

        it("refuses a signature without the sha256 scheme", async () => {
            const { service } = await build()
            const timestamp = String(SIGNED_AT)

            expect(() => service.verify({ provider: "payments", rawBody: BODY, signature: sign(timestamp), timestamp })).toThrow(
                refusal(HttpSecurityErrorCode.WebhookSignatureInvalid),
            )
        })

        it("refuses a signature of another length and one made with another secret", async () => {
            const { service } = await build()
            const timestamp = String(SIGNED_AT)

            expect(() => service.verify({ provider: "payments", rawBody: BODY, signature: "sha256=abc", timestamp })).toThrow(
                refusal(HttpSecurityErrorCode.WebhookSignatureInvalid),
            )
            expect(() =>
                service.verify({ provider: "payments", rawBody: BODY, signature: `sha256=${sign(timestamp, BODY, "other")}`, timestamp }),
            ).toThrow(refusal(HttpSecurityErrorCode.WebhookSignatureInvalid))
        })

        it("refuses a delivery whose body was changed after signing", async () => {
            const { service } = await build()
            const timestamp = String(SIGNED_AT)

            expect(() =>
                service.verify({ provider: "payments", rawBody: Buffer.from("{}"), signature: `sha256=${sign(timestamp)}`, timestamp }),
            ).toThrow(refusal(HttpSecurityErrorCode.WebhookSignatureInvalid))
        })

        it("refuses a correctly signed delivery outside the replay window, in either direction", async () => {
            const { service } = await build()
            const stale = String(SIGNED_AT - 300_001)
            const future = String(SIGNED_AT + 300_001)

            expect(() =>
                service.verify({ provider: "payments", rawBody: BODY, signature: `sha256=${sign(stale)}`, timestamp: stale }),
            ).toThrow(refusal(HttpSecurityErrorCode.WebhookReplayed))
            expect(() =>
                service.verify({ provider: "payments", rawBody: BODY, signature: `sha256=${sign(future)}`, timestamp: future }),
            ).toThrow(refusal(HttpSecurityErrorCode.WebhookReplayed))
        })

        it("accepts a delivery exactly at the edge of the replay window", async () => {
            const { service } = await build()
            const edge = String(SIGNED_AT - 300_000)

            expect(() =>
                service.verify({ provider: "payments", rawBody: BODY, signature: `sha256=${sign(edge)}`, timestamp: edge }),
            ).not.toThrow()
        })
    })
})
