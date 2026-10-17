import { createHmac } from "node:crypto"
import { Test } from "@nestjs/testing"
import { FakeClock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { HttpSecurityErrorCode } from "@modules/platform/http-security"
import { SEPAY_OPTIONS } from "./sepay.decorators"
import { SepaySignatureService } from "./sepay-signature.service"

describe("SepaySignatureService", () => {
    it("uses the injected secret and clock for signature and replay checks", async () => {
        const clock = new FakeClock("2026-10-02T03:00:00.000Z")
        const secret = new Secret("sepay-unit-signing-secret")
        const moduleRef = await Test.createTestingModule({
            providers: [
                SepaySignatureService,
                { provide: SEPAY_OPTIONS, useValue: { secret, toleranceMs: 1000 } },
                { provide: CLOCK, useValue: clock },
            ],
        }).compile()
        try {
            const service = moduleRef.get(SepaySignatureService)
            const timestamp = String(clock.now().getTime())
            const rawBody = Buffer.from('{"id":92704}')
            const signature = `sha256=${createHmac("sha256", secret.reveal()).update(`${timestamp}.`).update(rawBody).digest("hex")}`
            const delivery = { provider: "sepay", timestamp, rawBody, signature }

            expect(() => service.verify(delivery)).not.toThrow()
            expect(() => service.verify({ ...delivery, rawBody: Buffer.from("{}") })).toThrow(
                expect.objectContaining({ code: HttpSecurityErrorCode.WebhookSignatureInvalid }),
            )
            clock.advance(1001)
            expect(() => service.verify(delivery)).toThrow(
                expect.objectContaining({ code: HttpSecurityErrorCode.WebhookReplayed }),
            )
        } finally {
            await moduleRef.close()
        }
    })
})
