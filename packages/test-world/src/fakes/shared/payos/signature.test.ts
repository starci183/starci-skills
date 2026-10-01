import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"
import { payosCreateCanonicalString, payosDataCanonicalString, payosSignCreate, payosSignData, payosVerifyCreate, payosVerifyData } from "./signature"
import { payosCreateRequest, payosEnvelope, payosGetData, payosPaymentData, payosWebhookBody } from "./payloads"
import { PAYOS_ERROR_INVALID_SIGNATURE, PAYOS_ERROR_UNAUTHORIZED } from "./fixtures"

const KEY = "checksum-key-0123456789abcdef"
const hmac = (data: string): string => createHmac("sha256", KEY).update(data).digest("hex")

const CREATE = {
    orderCode: 123,
    amount: 2000,
    description: "VQRIO123",
    cancelUrl: "http://localhost/cancel",
    returnUrl: "http://localhost/return",
}

test("payos create canonical string is the five sorted fields", () => {
    const expected = "amount=2000&cancelUrl=http://localhost/cancel&description=VQRIO123&orderCode=123&returnUrl=http://localhost/return"
    assert.equal(payosCreateCanonicalString(CREATE), expected)
    assert.equal(payosSignCreate(CREATE, KEY), hmac(expected))
    const signed = payosCreateRequest(CREATE, KEY)
    assert.equal(payosVerifyCreate(signed, signed.signature, KEY), true)
    assert.equal(payosVerifyCreate(signed, signed.signature, "wrong"), false)
    assert.equal(payosVerifyCreate({ ...signed, amount: 1 }, signed.signature, KEY), false)
})

test("payos data canonical string sorts keys and empties null values", () => {
    const data = { orderCode: 123, amount: 3000, description: "VQRIO123", accountNumber: "12345678", nothing: null, missing: undefined, tag: "null" }
    const expected = "accountNumber=12345678&amount=3000&description=VQRIO123&missing=&nothing=&orderCode=123&tag="
    assert.equal(payosDataCanonicalString(data), expected)
    assert.equal(payosSignData(data, KEY), hmac(expected))
    assert.equal(payosVerifyData(data, hmac(expected), KEY), true)
    assert.equal(payosVerifyData(data, hmac(expected), "wrong"), false)
})

test("payos array values are json stringified with sorted keys", () => {
    assert.equal(payosDataCanonicalString({ b: [{ z: 1, a: 2 }], a: "x" }), 'a=x&b=[{"a":2,"z":1}]')
})

test("payos webhook body is signed over its data and carries success/failure codes", () => {
    const paid = payosWebhookBody(
        { orderCode: 123, amount: 3000, description: "VQRIO123", paymentLinkId: "pl1", reference: "TF230204212323", transactionDateTime: "2023-02-04 18:25:00" },
        KEY,
    )
    assert.equal(paid.code, "00")
    assert.equal(paid.success, true)
    assert.equal(paid.data.code, "00")
    assert.equal(paid.data.desc, "Thanh cong")
    assert.equal(payosVerifyData(paid.data, paid.signature, KEY), true)
    assert.equal(payosVerifyData(paid.data, paid.signature, "wrong"), false)
    const failed = payosWebhookBody(
        { orderCode: 1, amount: 1, description: "d", paymentLinkId: "p", reference: "r", transactionDateTime: "t", dataCode: "01" },
        KEY,
    )
    assert.equal(failed.success, false)
    assert.notEqual(failed.code, "00")
})

test("payos envelope, payment data and get data", () => {
    const data = payosPaymentData({ orderCode: 123, amount: 2000, description: "d", paymentLinkId: "pl1", checkoutUrl: "http://x/web/pl1", status: "PENDING" })
    assert.equal(data.status, "PENDING")
    assert.equal(data.currency, "VND")
    const envelope = payosEnvelope(data, KEY)
    assert.equal(envelope.code, "00")
    assert.equal(envelope.desc, "success")
    assert.equal(payosVerifyData(envelope.data as unknown as Record<string, unknown>, envelope.signature, KEY), true)
    const got = payosGetData({ orderCode: 123, amount: 2000, description: "d", paymentLinkId: "pl1", checkoutUrl: "", status: "PAID", createdAt: "2026-01-01T00:00:00Z", reference: "R" })
    assert.equal(got.amountPaid, 2000)
    assert.equal(got.transactions.length, 1)
    assert.equal(PAYOS_ERROR_UNAUTHORIZED.code, "401")
    assert.equal(PAYOS_ERROR_INVALID_SIGNATURE.data, null)
})
