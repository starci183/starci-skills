import assert from "node:assert/strict"
import { test } from "node:test"
import { withPaymentFake, waitUntil } from "../payment-kit/app-double.spec"
import { vnpayFake } from "./index"
import {
    VNPAY_QUERYDR_REQUEST_FIELDS,
    VNPAY_QUERYDR_RESPONSE_FIELDS,
    VNPAY_REFUND_REQUEST_FIELDS,
    vnpayPayUrl,
    vnpayPaymentRequest,
    vnpayPipeSign,
    vnpayPipeVerify,
    vnpayVerify,
} from "./index"

const IPN_OK = JSON.stringify({ RspCode: "00", Message: "Confirm Success" })

const payParams = (tmnCode: string, txnRef: string, amountVnd: number): Record<string, string> => ({
    ...vnpayPaymentRequest({
        vnp_TmnCode: tmnCode,
        vnp_TxnRef: txnRef,
        vnp_Amount: String(amountVnd * 100),
        vnp_ReturnUrl: "http://localhost:3000/vnpay/return",
    }),
})

test("vnpay: pay url is verified, settle calls the IPN with a valid signature, replay is byte-identical", async () => {
    await withPaymentFake(vnpayFake(), async ({ client, values, baseUrl, app }) => {
        const tmnCode = values["tmnCode"] ?? ""
        const secret = values["hashSecret"] ?? ""
        app.answer(200, IPN_OK)

        const tampered = vnpayPayUrl(baseUrl, payParams(tmnCode, "ORD1", 10000), `${secret}x`)
        assert.equal((await fetch(tampered)).status, 400)
        assert.deepEqual(await client.intents(), [])

        const payUrl = vnpayPayUrl(baseUrl, payParams(tmnCode, "ORD1", 10000), secret)
        assert.equal((await fetch(payUrl)).status, 200)
        const [pending] = await client.intents()
        assert.equal(pending?.reference, "ORD1")
        assert.equal(pending?.amount, 10000)
        assert.equal(pending?.status, "pending")

        const delivery = await client.settle({ reference: "ORD1" })
        assert.equal(delivery.status, 200)
        assert.equal(delivery.response, IPN_OK)
        assert.equal(app.received.length, 1)
        const first = app.received[0]
        assert.equal(first?.method, "GET")
        const url = new URL(first?.url ?? "", "http://app.local")
        assert.equal(url.pathname, "/payment/vnpay/ipn")
        const query = Object.fromEntries(url.searchParams)
        assert.equal(vnpayVerify(query, secret), true)
        assert.equal(vnpayVerify(query, `${secret}x`), false)
        assert.equal(query["vnp_ResponseCode"], "00")
        assert.equal(query["vnp_TxnRef"], "ORD1")
        assert.equal(query["vnp_Amount"], "1000000")

        const [paid] = await client.intents()
        assert.equal(paid?.status, "paid")
        assert.ok(paid?.signedReturnUrl?.startsWith("http://localhost:3000/vnpay/return?"))
        const returned = Object.fromEntries(new URL(paid?.signedReturnUrl ?? "").searchParams)
        assert.equal(vnpayVerify(returned, secret), true)

        const replayed = await client.replayWebhook("ORD1")
        assert.equal(replayed.url, delivery.url)
        assert.equal(app.received[1]?.url, first?.url)
        assert.equal((await client.deliveries()).length, 2)
    })
})

test("vnpay: fail sends the cancelled code, badSignature signs with a wrong secret once", async () => {
    await withPaymentFake(vnpayFake(), async ({ client, values, baseUrl, app }) => {
        const secret = values["hashSecret"] ?? ""
        app.answer(200, IPN_OK)
        await fetch(vnpayPayUrl(baseUrl, payParams(values["tmnCode"] ?? "", "ORD2", 5000), secret))
        await client.failNext({ badSignature: true })
        await client.fail({ reference: "ORD2" })
        const bad = Object.fromEntries(new URL(app.received[0]?.url ?? "", "http://app.local").searchParams)
        assert.equal(bad["vnp_ResponseCode"], "24")
        assert.equal(vnpayVerify(bad, secret), false)
        await client.replayWebhook("ORD2")
        assert.equal(app.received[1]?.url, app.received[0]?.url)
        await client.settle({ reference: "ORD2" })
        const good = Object.fromEntries(new URL(app.received[2]?.url ?? "", "http://app.local").searchParams)
        assert.equal(vnpayVerify(good, secret), true)
    })
})

test("vnpay: querydr and refund are signed both ways", async () => {
    await withPaymentFake(vnpayFake(), async ({ client, values, baseUrl, app }) => {
        const tmnCode = values["tmnCode"] ?? ""
        const secret = values["hashSecret"] ?? ""
        app.answer(200, IPN_OK)
        await fetch(vnpayPayUrl(baseUrl, payParams(tmnCode, "ORD3", 20000), secret))
        await client.settle({ reference: "ORD3" })
        const call = async (body: Record<string, string>, fields: ReadonlyArray<string>, signWith = secret): Promise<Record<string, string>> => {
            const response = await fetch(values["apiUrl"] ?? "", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ ...body, vnp_SecureHash: vnpayPipeSign(body, fields, signWith) }),
            })
            return (await response.json()) as Record<string, string>
        }
        const querydr = {
            vnp_RequestId: "q1",
            vnp_Version: "2.1.0",
            vnp_Command: "querydr",
            vnp_TmnCode: tmnCode,
            vnp_TxnRef: "ORD3",
            vnp_OrderInfo: "check",
            vnp_TransactionDate: "20260301120000",
            vnp_CreateDate: "20260301120100",
            vnp_IpAddr: "127.0.0.1",
        }
        const answer = await call(querydr, VNPAY_QUERYDR_REQUEST_FIELDS)
        assert.equal(answer["vnp_ResponseCode"], "00")
        assert.equal(answer["vnp_TransactionStatus"], "00")
        assert.equal(vnpayPipeVerify(answer, VNPAY_QUERYDR_RESPONSE_FIELDS, secret), true)
        assert.equal((await call(querydr, VNPAY_QUERYDR_REQUEST_FIELDS, "wrong"))["vnp_ResponseCode"], "97")
        assert.equal((await call({ ...querydr, vnp_TxnRef: "nope" }, VNPAY_QUERYDR_REQUEST_FIELDS))["vnp_ResponseCode"], "91")

        const refund = {
            vnp_RequestId: "r1",
            vnp_Version: "2.1.0",
            vnp_Command: "refund",
            vnp_TmnCode: tmnCode,
            vnp_TransactionType: "02",
            vnp_TxnRef: "ORD3",
            vnp_Amount: "2000000",
            vnp_OrderInfo: "refund",
            vnp_TransactionNo: "",
            vnp_TransactionDate: "20260301120000",
            vnp_CreateBy: "admin",
            vnp_CreateDate: "20260301120200",
            vnp_IpAddr: "127.0.0.1",
        }
        const refunded = await call(refund, VNPAY_REFUND_REQUEST_FIELDS)
        assert.equal(refunded["vnp_ResponseCode"], "00")
        assert.equal((await client.intents())[0]?.refunded, 20000)
        assert.equal((await call(refund, VNPAY_REFUND_REQUEST_FIELDS))["vnp_ResponseCode"], "94")
    })
})

test("vnpay: a delayed webhook arrives later and reset clears it", async () => {
    await withPaymentFake(vnpayFake(), async ({ client, values, baseUrl, app }) => {
        const secret = values["hashSecret"] ?? ""
        app.answer(200, IPN_OK)
        await fetch(vnpayPayUrl(baseUrl, payParams(values["tmnCode"] ?? "", "ORD4", 1000), secret))
        await client.delayWebhook({ reference: "ORD4", delayMs: 150 })
        assert.equal((await client.intents())[0]?.status, "paid")
        assert.equal(app.received.length, 0)
        assert.equal(await waitUntil(() => app.received.length === 1), true)

        await fetch(vnpayPayUrl(baseUrl, payParams(values["tmnCode"] ?? "", "ORD5", 1000), secret))
        await client.delayWebhook({ reference: "ORD5", delayMs: 200 })
        await client.reset()
        await new Promise((resolve) => setTimeout(resolve, 400))
        assert.equal(app.received.length, 1)
        assert.deepEqual(await client.intents(), [])
    })
})

test("vnpay: an unknown reference is refused by the control channel", async () => {
    await withPaymentFake(vnpayFake(), async ({ client }) => {
        await assert.rejects(client.settle({ reference: "ghost" }), /TEST_WORLD_FAKE_CONTROL_FAILED/)
        await assert.rejects(client.replayWebhook("ghost"), /TEST_WORLD_FAKE_CONTROL_FAILED/)
    })
})
