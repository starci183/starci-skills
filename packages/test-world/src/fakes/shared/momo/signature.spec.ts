import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"
import {
    MOMO_CREATE_REQUEST_FIELDS,
    MOMO_CREATE_RESPONSE_FIELDS,
    MOMO_IPN_FIELDS,
    MOMO_QUERY_REQUEST_FIELDS,
    momoCanonicalString,
    momoSign,
    momoVerify,
} from "./signature"
import { momoCreateRequest, momoCreateResponse, momoPendingResult, momoRefundResponse, momoResult } from "./payloads"
import { MOMO_ERROR_INVALID_SIGNATURE, MOMO_EXPIRED, MOMO_USER_DENIED, momoMessage } from "./fixtures"

const ACCESS = "klm05TvNBzhg7h7j"
const SECRET = "at67qH6mk8w5Y1nAyMoYKMWACiEi2bsa"
const hmac = (data: string): string => createHmac("sha256", SECRET).update(data).digest("hex")

// The sample inputs of MoMo's documentation (captureWallet).
const REQUEST = {
    partnerCode: "MOMO",
    requestId: "MM1540456472575",
    amount: 150000,
    orderId: "MM1540456472575",
    orderInfo: "pay with MoMo",
    redirectUrl: "https://webhook.site/b3088a6a",
    ipnUrl: "https://webhook.site/b3088a6a",
    requestType: "captureWallet",
    extraData: "",
}

test("momo create canonical string is alphabetical with the access key", () => {
    const expected =
        "accessKey=klm05TvNBzhg7h7j&amount=150000&extraData=&ipnUrl=https://webhook.site/b3088a6a&orderId=MM1540456472575" +
        "&orderInfo=pay with MoMo&partnerCode=MOMO&redirectUrl=https://webhook.site/b3088a6a&requestId=MM1540456472575&requestType=captureWallet"
    assert.equal(momoCanonicalString(REQUEST, MOMO_CREATE_REQUEST_FIELDS, { accessKey: ACCESS }), expected)
    assert.equal(momoSign(REQUEST, MOMO_CREATE_REQUEST_FIELDS, SECRET, { accessKey: ACCESS }), hmac(expected))
})

test("momo create request builder signs, verify rejects wrong secret and tampering", () => {
    const { partnerCode, requestId, amount, orderId, orderInfo, redirectUrl, ipnUrl } = REQUEST
    const signed = momoCreateRequest({ partnerCode, requestId, amount, orderId, orderInfo, redirectUrl, ipnUrl }, ACCESS, SECRET)
    assert.equal(signed.signature, momoSign(REQUEST, MOMO_CREATE_REQUEST_FIELDS, SECRET, { accessKey: ACCESS }))
    assert.equal(momoVerify(signed, MOMO_CREATE_REQUEST_FIELDS, SECRET, { accessKey: ACCESS }), true)
    assert.equal(momoVerify(signed, MOMO_CREATE_REQUEST_FIELDS, `${SECRET}x`, { accessKey: ACCESS }), false)
    assert.equal(momoVerify({ ...signed, amount: 1 }, MOMO_CREATE_REQUEST_FIELDS, SECRET, { accessKey: ACCESS }), false)
    assert.equal(momoVerify({ ...signed, signature: "" }, MOMO_CREATE_REQUEST_FIELDS, SECRET, { accessKey: ACCESS }), false)
})

test("momo create response is signed over its own field list", () => {
    const answer = momoCreateResponse(REQUEST, "http://127.0.0.1:1/pay?orderId=x", 1700000000000, ACCESS, SECRET)
    assert.equal(answer.resultCode, 0)
    assert.equal(answer.message, "Successful.")
    assert.ok(answer.deeplink.startsWith("momo://"))
    assert.equal(momoVerify(answer, MOMO_CREATE_RESPONSE_FIELDS, SECRET, { accessKey: ACCESS }), true)
})

test("momo ipn canonical string and results", () => {
    const success = momoResult(
        { partnerCode: "MOMO", orderId: "o1", requestId: "r1", amount: 5000, orderInfo: "info", extraData: "", transId: 2820000001, resultCode: 0, responseTime: 1700000000000 },
        ACCESS,
        SECRET,
    )
    const expected =
        "accessKey=klm05TvNBzhg7h7j&amount=5000&extraData=&message=Successful.&orderId=o1&orderInfo=info&orderType=momo_wallet" +
        "&partnerCode=MOMO&payType=qr&requestId=r1&responseTime=1700000000000&resultCode=0&transId=2820000001"
    assert.equal(momoCanonicalString(success, MOMO_IPN_FIELDS, { accessKey: ACCESS }), expected)
    assert.equal(success.signature, hmac(expected))
    assert.equal(momoVerify(success, MOMO_IPN_FIELDS, SECRET, { accessKey: ACCESS }), true)
    assert.equal(momoVerify(success, MOMO_IPN_FIELDS, "wrong", { accessKey: ACCESS }), false)

    const denied = momoResult({ partnerCode: "MOMO", orderId: "o1", requestId: "r1", amount: 5000, orderInfo: "info", extraData: "", transId: 9, resultCode: MOMO_USER_DENIED, responseTime: 1 }, ACCESS, SECRET)
    assert.equal(denied.resultCode, 1006)
    assert.equal(denied.transId, 0)
    assert.equal(momoVerify(denied, MOMO_IPN_FIELDS, SECRET, { accessKey: ACCESS }), true)
    assert.equal(momoMessage(MOMO_EXPIRED), "Transaction failed because the url or QR code expired.")
    assert.equal(momoMessage(123456), "Unknown.")
    assert.equal(MOMO_ERROR_INVALID_SIGNATURE.resultCode, 13)

    const pending = momoPendingResult({ partnerCode: "MOMO", orderId: "o1", requestId: "r1", amount: 5000, orderInfo: "info", extraData: "", responseTime: 1 }, ACCESS, SECRET)
    assert.equal(pending.resultCode, 1000)
})

test("momo query request field order and refund answer", () => {
    assert.equal(
        momoCanonicalString({ partnerCode: "MOMO", orderId: "o1", requestId: "r1" }, MOMO_QUERY_REQUEST_FIELDS, { accessKey: ACCESS }),
        "accessKey=klm05TvNBzhg7h7j&orderId=o1&partnerCode=MOMO&requestId=r1",
    )
    const refund = momoRefundResponse({ partnerCode: "MOMO", orderId: "o1", requestId: "r2", amount: 5000, transId: 7 }, 5)
    assert.equal(refund.resultCode, 0)
    assert.equal(refund.transId, 7)
})
