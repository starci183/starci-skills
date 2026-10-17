import { fakeIds } from "@starci/jest-preset"
import { SepayModule, SepayErrorCode, parseSepayConfig } from "@modules/integrations/sepay"
import { EnvSource } from "@modules/platform/config"
import { WebhookSignatureService } from "@modules/platform/http-security"
import { present } from "../../fixtures/present.mapper"
import { useTestWorld } from "../../world/use-test-world"

const ids = fakeIds()

/** Proves the notifier's exact signed bytes against the real signature capability and billing door. */
describe("sepay: notifier signature (integration)", () => {
    const world = useTestWorld({
        modules: [
            (w) =>
                SepayModule.register(
                    parseSepayConfig(new EnvSource({ SEPAY_WEBHOOK_SECRET: w.fake.sepay.values.webhookSecret })),
                ),
        ],
        apps: ["billing"],
    })

    const verify = (delivery: Awaited<ReturnType<typeof world.fake.sepay.replayWebhook>>) =>
        world.resolve(WebhookSignatureService).verify({
            provider: "sepay",
            rawBody: Buffer.from(delivery.body),
            signature: delivery.headers["x-sepay-signature"],
            timestamp: delivery.headers["x-sepay-timestamp"],
        })

    it("accepts exact signed bytes and refuses a changed body", async () => {
        const delivery = present(
            await world.fake.sepay.settle({ reference: ids.next(), amount: 1500 }),
            "signed notifier delivery",
        )

        expect(delivery.status).toBe(204)
        expect(() => verify(delivery)).not.toThrow()
        expect(() => verify({ ...delivery, body: `${delivery.body} ` })).toThrow(
            expect.objectContaining({ code: SepayErrorCode.WebhookSignatureInvalid }),
        )
    })

    it("refuses a bad signature and stale replay, then accepts a freshly signed retry", async () => {
        const reference = ids.next()
        await world.fake.sepay.failNext({ badSignature: true })
        const bad = present(await world.fake.sepay.settle({ reference, amount: 1500 }), "bad signature delivery")

        expect(bad.status).toBe(401)
        expect(() => verify(bad)).toThrow(expect.objectContaining({ code: SepayErrorCode.WebhookSignatureInvalid }))

        const stale = await world.fake.sepay.replayWebhook(reference, { ageMs: 600_000 })
        expect(stale.status).toBe(401)
        expect(() => verify(stale)).toThrow(expect.objectContaining({ code: SepayErrorCode.WebhookReplayed }))

        const retried = await world.fake.sepay.replayWebhook(reference, { ageMs: 1 })
        expect(retried.status).toBe(204)
        expect(retried.body).toBe(bad.body)
        expect(() => verify(retried)).not.toThrow()
    })
})
