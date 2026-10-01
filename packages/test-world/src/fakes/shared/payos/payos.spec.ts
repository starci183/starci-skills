import assert from "node:assert/strict"
import { test } from "node:test"
import { waitUntil, withPaymentFake } from "../payment-kit/app-double.test"
import { payosCreateRequest, payosFake, payosVerifyData } from "./index"

type Json = Record<string, unknown>

const call = async (
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: unknown,
): Promise<{ readonly status: number; readonly json: Json }> => {
    const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, json: (await response.json()) as Json }
}

const draft = (orderCode: number, amount = 3000): Parameters<typeof payosCreateRequest>[0] => ({
    orderCode,
    amount,
    description: `DH${orderCode}`,
    cancelUrl: "http://localhost:3000/cancel",
    returnUrl: "http://localhost:3000/return",
})

test("payos: create verifies auth and signature, webhook is signed over data, replay is byte-identical", async () => {
    await withPaymentFake(payosFake(), async ({ client, values, baseUrl, app }) => {
        const key = values["checksumKey"] ?? ""
        const auth = { "x-client-id": values["clientId"] ?? "", "x-api-key": values["apiKey"] ?? "" }
        app.answer(200, JSON.stringify({ success: true }))
        const create = `${baseUrl}/v2/payment-requests`

        assert.equal((await call("POST", create, { "x-client-id": "x", "x-api-key": "y" }, payosCreateRequest(draft(101), key))).status, 401)
        assert.equal((await call("POST", create, auth, payosCreateRequest(draft(101), `${key}x`))).json["code"], "201")

        const created = await call("POST", create, auth, payosCreateRequest(draft(101), key))
        assert.equal(created.json["code"], "00")
        const data = created.json["data"] as Json
        assert.equal(data["status"], "PENDING")
        assert.equal(data["orderCode"], 101)
        assert.match(String(data["checkoutUrl"]), /\/web\/[0-9a-f]{32}$/)
        assert.equal(payosVerifyData(data, String(created.json["signature"]), key), true)
        assert.equal((await call("POST", create, auth, payosCreateRequest(draft(101), key))).json["code"], "231")

        const byCode = await call("GET", `${create}/101`, auth)
        assert.equal((byCode.json["data"] as Json)["status"], "PENDING")
        const byLink = await call("GET", `${create}/${String(data["paymentLinkId"])}`, auth)
        assert.equal((byLink.json["data"] as Json)["orderCode"], 101)
        assert.equal((await call("GET", `${create}/999`, auth)).json["code"], "101")

        const delivery = await client.settle({ reference: "101" })
        assert.equal(delivery.status, 200)
        assert.equal(app.received[0]?.url, "/payment/payos/webhook")
        const webhook = JSON.parse(app.received[0]?.body ?? "{}") as Json
        assert.equal(webhook["success"], true)
        const hookData = webhook["data"] as Json
        assert.equal(hookData["orderCode"], 101)
        assert.equal(hookData["amount"], 3000)
        assert.equal(hookData["code"], "00")
        assert.equal(payosVerifyData(hookData, String(webhook["signature"]), key), true)
        assert.equal(payosVerifyData(hookData, String(webhook["signature"]), `${key}x`), false)

        assert.equal(((await call("GET", `${create}/101`, auth)).json["data"] as Json)["status"], "PAID")
        assert.equal((await call("POST", `${create}/101/cancel`, auth, {})).json["code"], "112")
        await client.replayWebhook("101")
        assert.equal(app.received[1]?.body, app.received[0]?.body)
        assert.equal((await client.intents())[0]?.status, "PAID")
    })
})

test("payos: cancel, fail webhook, bad signature and confirm-webhook", async () => {
    await withPaymentFake(payosFake(), async ({ client, values, baseUrl, app }) => {
        const key = values["checksumKey"] ?? ""
        const auth = { "x-client-id": values["clientId"] ?? "", "x-api-key": values["apiKey"] ?? "" }
        app.answer(200, "{}")
        const create = `${baseUrl}/v2/payment-requests`
        await call("POST", create, auth, payosCreateRequest(draft(202), key))
        await call("POST", create, auth, payosCreateRequest(draft(203), key))

        const cancelled = await call("POST", `${create}/202/cancel`, auth, { cancellationReason: "test" })
        assert.equal((cancelled.json["data"] as Json)["status"], "CANCELLED")

        await client.failNext({ badSignature: true })
        await client.fail({ reference: "203", code: "01" })
        const hook = JSON.parse(app.received[0]?.body ?? "{}") as Json
        assert.equal(hook["success"], false)
        assert.equal(payosVerifyData(hook["data"] as Json, String(hook["signature"]), key), false)
        assert.equal((await client.intents())[1]?.status, "CANCELLED")

        const confirmed = await call("POST", `${baseUrl}/confirm-webhook`, auth, { webhookUrl: "https://app.example/hook" })
        assert.equal(confirmed.json["code"], "00")
        assert.equal((confirmed.json["data"] as Json)["webhookUrl"], "https://app.example/hook")
        assert.equal((await call("POST", `${baseUrl}/confirm-webhook`, { "x-api-key": "no" }, {})).status, 401)
    })
})

test("payos: a delayed webhook arrives later and reset clears it", async () => {
    await withPaymentFake(payosFake(), async ({ client, values, baseUrl, app }) => {
        const key = values["checksumKey"] ?? ""
        const auth = { "x-client-id": values["clientId"] ?? "", "x-api-key": values["apiKey"] ?? "" }
        app.answer(200, "{}")
        for (const code of [301, 302]) await call("POST", `${baseUrl}/v2/payment-requests`, auth, payosCreateRequest(draft(code), key))
        await client.delayWebhook({ reference: "301", delayMs: 150 })
        assert.equal((await client.intents())[0]?.status, "PAID")
        assert.equal(app.received.length, 0)
        assert.equal(await waitUntil(() => app.received.length === 1), true)
        await client.delayWebhook({ reference: "302", delayMs: 200 })
        await client.reset()
        await new Promise((resolve) => setTimeout(resolve, 400))
        assert.equal(app.received.length, 1)
    })
})
