import { randomUUID } from "node:crypto"
import { SepayClient, SepayModule, parseSepayConfig } from "@modules/integrations/sepay"
import { contractClient, fetchJson } from "@tests/world/contract.client"
import { shapeOf } from "@tests/world/payload-shape.policy"
import { renderPayload } from "@tests/world/fakes/payload.service"

/**
 * Contract of the payment gateway: the REAL SePay client against the SePay sandbox, compared with the fake the e2e world
 * serves at the network edge. It proves the client still speaks the provider (create an intent, read it back) and that the
 * payload fixtures under `world/fakes/sepay/payloads/` still have the shape of what the sandbox answers. Runs only when the
 * sandbox keys are declared in the environment (`SEPAY_BASE_URL`, `SEPAY_API_KEY`, `SEPAY_WEBHOOK_SECRET` of the sandbox
 * account); otherwise skipped. No secret is read from or written to the repository.
 */
const sandbox = contractClient({
    provider: "sepay",
    keys: ["SEPAY_BASE_URL", "SEPAY_API_KEY", "SEPAY_WEBHOOK_SECRET"],
    module: (env, registration) => SepayModule.register({ ...registration, ...parseSepayConfig(env) }),
    client: SepayClient,
})

sandbox.describe("sepay sandbox contract", () => {
    it("create intent -> read it back -> the raw answers have the shape of the fake fixtures", async () => {
        const client = sandbox.client()
        const reference = randomUUID()

        const created = await client.createIntent({ subscriptionId: reference, amount: 10_000, currency: "VND" })
        expect(created.gatewayIntentId).not.toBe("")
        expect(URL.canParse(created.checkoutUrl)).toBe(true)

        const read = await client.getTransaction(created.gatewayIntentId)
        expect(read.status).toBe("pending")

        // The raw bodies, not what the client parsed out of them, against the fixtures the fake serves.
        const env = sandbox.env()
        const headers = { accept: "application/json", authorization: `Bearer ${env.string("SEPAY_API_KEY")}` }
        const baseUrl = env.url("SEPAY_BASE_URL")
        const rawCreate = await fetchJson({
            method: "POST",
            url: `${baseUrl}/userapi/transactions/qr`,
            headers,
            body: { reference: randomUUID(), amount: 10_000, currency: "VND" },
        })
        expect(rawCreate.status).toBe(200)
        expect(shapeOf(rawCreate.body)).toEqual(
            shapeOf(renderPayload("sepay", "create-intent-response", { id: "x", checkoutUrl: "x" })),
        )
        const rawRead = await fetchJson({
            method: "GET",
            url: `${baseUrl}/userapi/transactions/details/${encodeURIComponent(created.gatewayIntentId)}`,
            headers,
        })
        expect(rawRead.status).toBe(200)
        expect(shapeOf(rawRead.body)).toEqual(shapeOf(renderPayload("sepay", "transaction-pending", { id: "x" })))

        // A wrong API key is refused the way the fake refuses it.
        const refused = await fetchJson({
            method: "GET",
            url: `${baseUrl}/userapi/transactions/details/x`,
            headers: { authorization: "Bearer wrong" },
        })
        expect(refused.status).toBe(401)
        expect(shapeOf(refused.body)).toEqual(shapeOf(renderPayload("sepay", "error-unauthorized")))
    })
})
