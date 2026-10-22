import { fakeIds } from "@starci/jest-preset"
import { SepayModule, HttpSecurityErrorCode } from "@modules/integrations/sepay"
import { Secret } from "@modules/platform/config"
import { WebhookSignatureService } from "@modules/platform/http-security"
import { present } from "../../fixtures/present.mapper"
import { useTestWorld } from "../../world/use-test-world"

const ids = fakeIds()

/** Proves the notifier's exact signed bytes against the real signature capability and billing door. */
describe("sepay: notifier signature (integration)", () => {
    const world = useTestWorld({
        modules: [
            (w) =>
                SepayModule.register({
                    secret: new Secret(
                        present(present(w.fake.sepay, "SePay fake").values.webhookSecret, "SePay signing secret"),
                    ),
                    toleranceMs: 300_000,
                }),
        ],
        apps: ["identity", "order", "billing"],
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
            expect.objectContaining({ code: HttpSecurityErrorCode.WebhookSignatureInvalid }),
        )
    })

    it("refuses a bad signature and stale replay, then accepts a freshly signed retry", async () => {
        const reference = ids.next()
        await world.fake.sepay.failNext({ badSignature: true })
        const bad = present(await world.fake.sepay.settle({ reference, amount: 1500 }), "bad signature delivery")

        expect(bad.status).toBe(401)
        expect(() => verify(bad)).toThrow(
            expect.objectContaining({ code: HttpSecurityErrorCode.WebhookSignatureInvalid }),
        )

        const stale = await world.fake.sepay.replayWebhook(reference, { ageMs: 600_000 })
        expect(stale.status).toBe(401)
        expect(() => verify(stale)).toThrow(expect.objectContaining({ code: HttpSecurityErrorCode.WebhookReplayed }))

        const retried = await world.fake.sepay.replayWebhook(reference, { ageMs: 1 })
        expect(retried.status).toBe(204)
        expect(retried.body).toBe(bad.body)
        expect(() => verify(retried)).not.toThrow()
    })
})
