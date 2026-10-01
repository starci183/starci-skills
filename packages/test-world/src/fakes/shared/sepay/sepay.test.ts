import assert from "node:assert/strict"
import { test } from "node:test"
import { waitUntil, withPaymentFake } from "../payment-kit/app-double.test"
import { sepayFake, sepayVerifyApiKey, sepayVerifyBearer, sepayVerifyBody } from "./index"

type Json = Record<string, unknown>

const call = async (method: string, url: string, apiKey: string, body?: unknown): Promise<{ readonly status: number; readonly json: Json }> => {
    const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, json: (await response.json()) as Json }
}

test("sepay (intent style, the todo integration): create, read, settle, replay", async () => {
    await withPaymentFake(sepayFake(), async ({ client, values, baseUrl, app }) => {
        const apiKey = values["apiKey"] ?? ""
        const secret = values["webhookSecret"] ?? ""
        app.answer(200, JSON.stringify({ ok: true }))
        const create = `${baseUrl}/userapi/transactions/qr`

        assert.equal((await call("POST", create, "wrong", { reference: "sub-1", amount: 90000, currency: "VND" })).json["error"], "unauthorized")
        const created = await call("POST", create, apiKey, { reference: "sub-1", amount: 90000, currency: "VND" })
        const id = String(created.json["id"])
        assert.equal(id, "fake-sepay-000001")
        assert.equal(created.json["qrCodeUrl"], `${baseUrl}/checkout/${id}`)

        const details = `${baseUrl}/userapi/transactions/details/${id}`
        assert.deepEqual((await call("GET", details, apiKey)).json, { id, status: "pending" })
        assert.equal((await call("GET", `${baseUrl}/userapi/transactions/details/nope`, apiKey)).status, 404)
        assert.equal((await client.intents())[0]?.reference, "sub-1")

        const delivery = await client.settle({ gatewayIntentId: id, status: "paid", periodEnd: "2026-04-01T00:00:00.000Z" })
        assert.equal(delivery?.status, 200)
        assert.equal(delivery?.reference, "sub-1")
        const sent = app.received[0]
        assert.equal(sent?.url, "/webhooks/sepay")
        assert.deepEqual(JSON.parse(sent?.body ?? "{}"), { id, status: "paid", periodEnd: "2026-04-01T00:00:00.000Z" })
        assert.equal(sepayVerifyBearer(sent?.headers["authorization"], secret), true)
        assert.equal(sepayVerifyBody(sent?.body ?? "", sent?.headers["x-sepay-signature"], secret), true)
        assert.deepEqual((await call("GET", details, apiKey)).json, { id, status: "paid", periodEnd: "2026-04-01T00:00:00.000Z" })

        await client.replayWebhook(id)
        assert.equal(app.received[1]?.body, sent?.body)
        assert.equal((await client.deliveries()).length, 2)

        await client.failNext({ badSignature: true })
        await client.settle({ gatewayIntentId: id, status: "failed" })
        const bad = app.received[2]
        assert.equal(sepayVerifyBearer(bad?.headers["authorization"], secret), false)
        assert.equal(sepayVerifyBody(bad?.body ?? "", bad?.headers["x-sepay-signature"], secret), false)
        assert.equal((JSON.parse(bad?.body ?? "{}") as Json)["status"], "failed")
    })
})

test("sepay (intent style): settle by reference, unknown ids and delay", async () => {
    await withPaymentFake(sepayFake(), async ({ client, values, baseUrl, app }) => {
        const apiKey = values["apiKey"] ?? ""
        app.answer(200, "{}")
        await call("POST", `${baseUrl}/userapi/transactions/qr`, apiKey, { reference: "sub-2", amount: 1, currency: "VND" })
        await client.delayWebhook({ reference: "sub-2", delayMs: 150 })
        assert.equal((await client.intents())[0]?.status, "paid")
        assert.equal(app.received.length, 0)
        assert.equal(await waitUntil(() => app.received.length === 1), true)

        await client.settle({ gatewayIntentId: "ghost-id", status: "paid" })
        assert.equal((await client.intents()).length, 2)
        await client.delayWebhook({ gatewayIntentId: "ghost-2", status: "paid", delayMs: 200 })
        await client.reset()
        await new Promise((resolve) => setTimeout(resolve, 400))
        assert.equal(app.received.length, 2)
        assert.deepEqual(await client.intents(), [])
    })
})

test("sepay (transaction style): the documented webhook with Apikey authorization", async () => {
    await withPaymentFake(sepayFake({ webhookStyle: "transaction", webhookPath: "/hooks/sepay" }), async ({ client, values, app }) => {
        const secret = values["webhookSecret"] ?? ""
        app.answer(200, JSON.stringify({ success: true }))
        const delivery = await client.settle({ reference: "SUB123", amount: 250000 })
        assert.equal(delivery?.status, 200)
        const sent = app.received[0]
        assert.equal(sent?.url, "/hooks/sepay")
        assert.equal(sepayVerifyApiKey(sent?.headers["authorization"], secret), true)
        const body = JSON.parse(sent?.body ?? "{}") as Json
        assert.equal(body["code"], "SUB123")
        assert.equal(body["transferType"], "in")
        assert.equal(body["transferAmount"], 250000)
        assert.equal(typeof body["id"], "number")
        assert.equal(typeof body["referenceCode"], "string")
        assert.equal((await client.intents())[0]?.status, "paid")

        assert.equal(await client.fail({ reference: "SUB123" }), null)
        assert.equal(app.received.length, 1)
        await client.replayWebhook("SUB123")
        assert.equal(app.received[1]?.body, sent?.body)

        await client.failNext({ badSignature: true })
        await client.settle({ reference: "SUB999", amount: 1000 })
        assert.equal(sepayVerifyApiKey(app.received[2]?.headers["authorization"], secret), false)
    })
})
