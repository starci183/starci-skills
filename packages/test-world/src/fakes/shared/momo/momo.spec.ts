import assert from "node:assert/strict"
import { test } from "node:test"
import { waitUntil, withPaymentFake } from "../payment-kit/app-double.spec"
import { MOMO_CREATE_RESPONSE_FIELDS, MOMO_IPN_FIELDS, MOMO_QUERY_REQUEST_FIELDS, MOMO_REFUND_REQUEST_FIELDS, momoCreateRequest, momoFake, momoSign, momoVerify } from "./index"

type Json = Record<string, unknown>

const post = async (url: string, body: unknown): Promise<{ readonly status: number; readonly json: Json }> => {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    return { status: response.status, json: (await response.json()) as Json }
}

const order = (partnerCode: string, orderId: string, amount = 50000): Parameters<typeof momoCreateRequest>[0] => ({
    partnerCode,
    requestId: `req-${orderId}`,
    amount,
    orderId,
    orderInfo: "pay with MoMo",
    redirectUrl: "http://localhost:3000/momo/return",
    ipnUrl: "http://localhost:3000/momo/ipn",
})

test("momo: create verifies the signature, settle posts a signed IPN, replay is byte-identical", async () => {
    await withPaymentFake(momoFake(), async ({ client, values, baseUrl, app }) => {
        const partnerCode = values["partnerCode"] ?? ""
        const accessKey = values["accessKey"] ?? ""
        const secretKey = values["secretKey"] ?? ""
        app.answer(204, "")
        const createUrl = `${baseUrl}/v2/gateway/api/create`

        const wrong = await post(createUrl, momoCreateRequest(order(partnerCode, "M1"), accessKey, `${secretKey}x`))
        assert.equal(wrong.json["resultCode"], 13)

        const created = await post(createUrl, momoCreateRequest(order(partnerCode, "M1"), accessKey, secretKey))
        assert.equal(created.status, 200)
        assert.equal(created.json["resultCode"], 0)
        assert.equal(created.json["orderId"], "M1")
        assert.match(String(created.json["payUrl"]), /^http:\/\/127\.0\.0\.1:\d+\/v2\/gateway\/pay/)
        assert.equal(momoVerify(created.json, MOMO_CREATE_RESPONSE_FIELDS, secretKey, { accessKey }), true)
        assert.equal((await post(createUrl, momoCreateRequest(order(partnerCode, "M1"), accessKey, secretKey))).json["resultCode"], 41)
        assert.equal((await post(createUrl, { ...momoCreateRequest(order(partnerCode, "M9"), accessKey, secretKey), amount: 5 })).json["resultCode"], 13)

        const [pending] = await client.intents()
        assert.equal(pending?.reference, "M1")
        assert.equal(pending?.amount, 50000)
        assert.equal(pending?.status, "pending")
        assert.equal(pending?.ipnUrl, "http://localhost:3000/momo/ipn")

        const delivery = await client.settle({ reference: "M1" })
        assert.equal(delivery.status, 204)
        const sent = app.received[0]
        assert.equal(sent?.method, "POST")
        assert.equal(sent?.url, "/payment/momo/ipn")
        const body = JSON.parse(sent?.body ?? "{}") as Json
        assert.equal(body["resultCode"], 0)
        assert.equal(body["orderId"], "M1")
        assert.equal(momoVerify(body, MOMO_IPN_FIELDS, secretKey, { accessKey }), true)
        assert.equal(momoVerify(body, MOMO_IPN_FIELDS, `${secretKey}x`, { accessKey }), false)

        await client.replayWebhook("M1")
        assert.equal(app.received[1]?.body, sent?.body)
        assert.equal((await client.deliveries()).length, 2)
    })
})

test("momo: query, refund and provider-side failure with a bad signature", async () => {
    await withPaymentFake(momoFake(), async ({ client, values, baseUrl, app }) => {
        const partnerCode = values["partnerCode"] ?? ""
        const accessKey = values["accessKey"] ?? ""
        const secretKey = values["secretKey"] ?? ""
        app.answer(204, "")
        await post(`${baseUrl}/v2/gateway/api/create`, momoCreateRequest(order(partnerCode, "M2"), accessKey, secretKey))

        const queryBody = { partnerCode, requestId: "q1", orderId: "M2", lang: "vi" }
        const signedQuery = { ...queryBody, signature: momoSign(queryBody, MOMO_QUERY_REQUEST_FIELDS, secretKey, { accessKey }) }
        const pending = await post(`${baseUrl}/v2/gateway/api/query`, signedQuery)
        assert.equal(pending.json["resultCode"], 1000)
        assert.equal((await post(`${baseUrl}/v2/gateway/api/query`, { ...signedQuery, orderId: "zzz" })).json["resultCode"], 13)

        await client.failNext({ badSignature: true })
        await client.fail({ reference: "M2" })
        const failedBody = JSON.parse(app.received[0]?.body ?? "{}") as Json
        assert.equal(failedBody["resultCode"], 1006)
        assert.equal(momoVerify(failedBody, MOMO_IPN_FIELDS, secretKey, { accessKey }), false)

        await client.settle({ reference: "M2" })
        const paid = await post(`${baseUrl}/v2/gateway/api/query`, signedQuery)
        assert.equal(paid.json["resultCode"], 0)
        assert.equal(momoVerify(paid.json, MOMO_IPN_FIELDS, secretKey, { accessKey }), true)

        const refundBody = { partnerCode, orderId: "M2", requestId: "rf1", amount: 50000, transId: paid.json["transId"], lang: "vi", description: "refund" }
        const signedRefund = { ...refundBody, signature: momoSign(refundBody, MOMO_REFUND_REQUEST_FIELDS, secretKey, { accessKey }) }
        assert.equal((await post(`${baseUrl}/v2/gateway/api/refund`, signedRefund)).json["resultCode"], 0)
        const again = { ...refundBody, requestId: "rf2" }
        const signedAgain = { ...again, signature: momoSign(again, MOMO_REFUND_REQUEST_FIELDS, secretKey, { accessKey }) }
        assert.equal((await post(`${baseUrl}/v2/gateway/api/refund`, signedAgain)).json["resultCode"], 21)
    })
})

test("momo: a delayed IPN arrives later and reset clears it", async () => {
    await withPaymentFake(momoFake({ webhookPath: "custom/ipn" }), async ({ client, values, baseUrl, app }) => {
        const partnerCode = values["partnerCode"] ?? ""
        const accessKey = values["accessKey"] ?? ""
        const secretKey = values["secretKey"] ?? ""
        app.answer(204, "")
        for (const id of ["M3", "M4"]) await post(`${baseUrl}/v2/gateway/api/create`, momoCreateRequest(order(partnerCode, id), accessKey, secretKey))
        await client.delayWebhook({ reference: "M3", delayMs: 150 })
        assert.equal((await client.intents())[0]?.status, "paid")
        assert.equal(app.received.length, 0)
        assert.equal(await waitUntil(() => app.received.length === 1), true)
        assert.equal(app.received[0]?.url, "/custom/ipn")

        await client.delayWebhook({ reference: "M4", delayMs: 200 })
        await client.reset()
        await new Promise((resolve) => setTimeout(resolve, 400))
        assert.equal(app.received.length, 1)
    })
})

test("momo: failNext status answers the injected failure", async () => {
    await withPaymentFake(momoFake({ partnerCode: "P", accessKey: "A", secretKey: "S" }), async ({ client, values, baseUrl }) => {
        assert.equal(values["secretKey"], "S")
        await client.failNext({ status: 503 })
        const failed = await post(`${baseUrl}/v2/gateway/api/create`, momoCreateRequest(order("P", "M5"), "A", "S"))
        assert.equal(failed.status, 503)
        assert.equal(failed.json["resultCode"], 99)
    })
})
