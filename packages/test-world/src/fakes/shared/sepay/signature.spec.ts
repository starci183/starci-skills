import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"
import { sepayApiKeyHeader, sepayBearerHeader, sepaySignature, sepayVerifyApiKey, sepayVerifyBearer, sepayVerifySignature } from "./signature"
import { sepayCreateResponse, sepayIntentWebhook, sepayTransactionPending, sepayTransactionSettled, sepayTransactionWebhook } from "./payloads"
import { SEPAY_ERROR_NOT_FOUND, SEPAY_ERROR_UNAUTHORIZED } from "./fixtures"

test("sepay authorization headers", () => {
    assert.equal(sepayApiKeyHeader("k"), "Apikey k")
    assert.equal(sepayBearerHeader("k"), "Bearer k")
    assert.equal(sepayVerifyApiKey("Apikey k", "k"), true)
    assert.equal(sepayVerifyApiKey("Apikey k", "other"), false)
    assert.equal(sepayVerifyApiKey("Bearer k", "k"), false)
    assert.equal(sepayVerifyApiKey(undefined, "k"), false)
    assert.equal(sepayVerifyBearer("Bearer k", "k"), true)
    assert.equal(sepayVerifyBearer("Apikey k", "k"), false)
})

test("sepay signature is HMAC-SHA256 of <timestamp>.<exact body>, so neither the body nor the time can change", () => {
    const body = '{"id":1}'
    const expected = `sha256=${createHmac("sha256", "s").update(`1700000000000.${body}`).digest("hex")}`
    assert.equal(sepaySignature(1700000000000, body, "s"), expected)
    assert.equal(sepayVerifySignature(body, "1700000000000", expected, "s"), true)
    assert.equal(sepayVerifySignature(body, "1700000000000", expected, "wrong"), false)
    assert.equal(sepayVerifySignature(`${body} `, "1700000000000", expected, "s"), false)
    assert.equal(sepayVerifySignature(body, "1700000000001", expected, "s"), false, "a moved timestamp breaks the signature")
    assert.equal(sepayVerifySignature(body, undefined, expected, "s"), false)
    assert.equal(sepayVerifySignature(body, "17e11", expected, "s"), false)
})

test("sepay payload shapes", () => {
    assert.deepEqual(sepayCreateResponse("i", "u"), { id: "i", qrCodeUrl: "u" })
    assert.deepEqual(sepayTransactionPending("i"), { id: "i", status: "pending" })
    assert.deepEqual(sepayTransactionSettled("i", "paid", "p"), { id: "i", status: "paid", periodEnd: "p" })
    assert.deepEqual(sepayIntentWebhook("i", "failed", "p"), { id: "i", status: "failed", periodEnd: "p" })
    const tx = sepayTransactionWebhook({ id: 92704, code: "SUB123", amount: 2277000, transactionDate: "2023-03-25 14:02:37" })
    assert.deepEqual(Object.keys(tx).sort(), [
        "accountNumber",
        "accumulated",
        "code",
        "content",
        "description",
        "gateway",
        "id",
        "referenceCode",
        "subAccount",
        "transactionDate",
        "transferAmount",
        "transferType",
    ])
    assert.equal(tx.transferType, "in")
    assert.equal(tx.transferAmount, 2277000)
    assert.equal(SEPAY_ERROR_UNAUTHORIZED.error, "unauthorized")
    assert.equal(SEPAY_ERROR_NOT_FOUND.error, "not_found")
})
