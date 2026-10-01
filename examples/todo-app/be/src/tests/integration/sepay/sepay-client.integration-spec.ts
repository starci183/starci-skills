import { randomUUID } from "node:crypto"
import { SEPAY, SepayErrorCode } from "@modules/integrations/sepay"
import type { SepayClient } from "@modules/integrations/sepay"
import { useTestWorld } from "@tests/world/use-test-world"
import { SEPAY_CAPABILITY_MODULES } from "@tests/world/test-capabilities.options"

const UNAUTHORIZED = 401
const AMOUNT = 99_000

/**
 * sepay: the real payment gateway client against the SePay fake at the network edge, no HTTP door of ours. An intent created
 * through the client is what the gateway recorded, and reading it back reports the status the gateway holds (pending; the
 * settlement arrives by webhook, which the e2e plan journey covers through the real door). A gateway refusal (a 4xx) is the
 * declared request-failed refusal naming the operation and the status, and a gateway that never answers runs the client into its own deadline as the same refusal with the reason
 * `timeout`; the next call goes through.
 */
describe("sepay: payment gateway client (integration)", () => {
    const world = useTestWorld({ modules: SEPAY_CAPABILITY_MODULES })

    const client = (): SepayClient => world.resolve<SepayClient>(SEPAY)

    it("creates an intent the gateway records and reads its pending status back", async () => {
        const subscriptionId = randomUUID()

        const created = await client().createIntent({ subscriptionId, amount: AMOUNT, currency: "VND" })

        const recorded = (await world.fake.sepay.intents()).find((intent) => intent.reference === subscriptionId)
        expect(recorded).toMatchObject({
            gatewayIntentId: created.gatewayIntentId,
            checkoutUrl: created.checkoutUrl,
            amount: AMOUNT,
            currency: "VND",
        })
        expect((await client().getTransaction(created.gatewayIntentId)).status).toBe("pending")
    })

    it("a gateway refusal is the declared request-failed refusal naming the operation and the status", async () => {
        await world.fake.sepay.failNext({ status: UNAUTHORIZED })

        await expect(
            client().createIntent({ subscriptionId: randomUUID(), amount: AMOUNT, currency: "VND" }),
        ).rejects.toMatchObject({
            code: SepayErrorCode.RequestFailed,
            params: { operation: "create-intent", reason: `http-${UNAUTHORIZED}`, status: UNAUTHORIZED },
        })
        await expect(client().getTransaction(`missing-${randomUUID()}`)).rejects.toMatchObject({
            code: SepayErrorCode.RequestFailed,
            params: { operation: "get-transaction", reason: "http-404" },
        })
    })

    it("a gateway that never answers is a request-failed timeout, and the next call goes through", async () => {
        await world.fake.sepay.failNext({ timeout: true })

        await expect(
            client().createIntent({ subscriptionId: randomUUID(), amount: AMOUNT, currency: "VND" }),
        ).rejects.toMatchObject({
            code: SepayErrorCode.RequestFailed,
            params: { operation: "create-intent", reason: "timeout" },
        })

        const created = await client().createIntent({ subscriptionId: randomUUID(), amount: AMOUNT, currency: "VND" })
        expect(created.gatewayIntentId).not.toBe("")
    })
})
