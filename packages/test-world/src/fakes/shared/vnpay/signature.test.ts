import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { test } from "node:test"
import { VNPAY_QUERYDR_REQUEST_FIELDS, vnpayCanonicalString, vnpayPipeSign, vnpayPipeString, vnpayPipeVerify, vnpaySign, vnpayVerify } from "./signature"
import { vnpayPayUrl, vnpayQuerydrResponse, vnpayResultParams } from "./payloads"

const SECRET = "SECRETSECRETSECRETSECRETSECRET12"
const hmac = (data: string, secret: string): string => createHmac("sha512", secret).update(data).digest("hex")

const PARAMS = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: "DEMOV210",
    vnp_Amount: "1000000",
    vnp_CurrCode: "VND",
    vnp_TxnRef: "5",
    vnp_OrderInfo: "Thanh toan don hang 5",
    vnp_ReturnUrl: "http://localhost:8888/order/vnpay_return",
    vnp_Locale: "vn",
    vnp_CreateDate: "20210801153333",
    vnp_IpAddr: "127.0.0.1",
    vnp_OrderType: "other",
    vnp_EmptyOne: "",
}

const CANONICAL =
    "vnp_Amount=1000000&vnp_Command=pay&vnp_CreateDate=20210801153333&vnp_CurrCode=VND&vnp_IpAddr=127.0.0.1&vnp_Locale=vn" +
    "&vnp_OrderInfo=Thanh+toan+don+hang+5&vnp_OrderType=other&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A8888%2Forder%2Fvnpay_return" +
    "&vnp_TmnCode=DEMOV210&vnp_TxnRef=5&vnp_Version=2.1.0"

test("vnpay canonical string is sorted, encoded with plus for spaces, without empty values", () => {
    assert.equal(vnpayCanonicalString(PARAMS), CANONICAL)
})

test("vnpay canonical string ignores the hash keys", () => {
    assert.equal(vnpayCanonicalString({ ...PARAMS, vnp_SecureHash: "x", vnp_SecureHashType: "HmacSHA512" }), CANONICAL)
})

test("vnpay sign is HMAC-SHA512 hex of the canonical string, verify accepts it and rejects a wrong secret or a tampered value", () => {
    const hash = vnpaySign(PARAMS, SECRET)
    assert.equal(hash, hmac(CANONICAL, SECRET))
    assert.match(hash, /^[0-9a-f]{128}$/)
    assert.equal(vnpayVerify({ ...PARAMS, vnp_SecureHash: hash }, SECRET), true)
    assert.equal(vnpayVerify({ ...PARAMS, vnp_SecureHash: hash }, `${SECRET}x`), false)
    assert.equal(vnpayVerify({ ...PARAMS, vnp_Amount: "1", vnp_SecureHash: hash }, SECRET), false)
    assert.equal(vnpayVerify(PARAMS, SECRET), false)
})

test("vnpay pipe string follows the documented field order, missing fields are empty", () => {
    const body = {
        vnp_RequestId: "r1",
        vnp_Version: "2.1.0",
        vnp_Command: "querydr",
        vnp_TmnCode: "DEMOV210",
        vnp_TxnRef: "5",
        vnp_TransactionDate: "20210801153333",
        vnp_CreateDate: "20210801160000",
        vnp_IpAddr: "127.0.0.1",
    }
    const expected = "r1|2.1.0|querydr|DEMOV210|5|20210801153333|20210801160000|127.0.0.1|"
    assert.equal(vnpayPipeString(body, VNPAY_QUERYDR_REQUEST_FIELDS), expected)
    const hash = vnpayPipeSign(body, VNPAY_QUERYDR_REQUEST_FIELDS, SECRET)
    assert.equal(hash, hmac(expected, SECRET))
    assert.equal(vnpayPipeVerify({ ...body, vnp_SecureHash: hash }, VNPAY_QUERYDR_REQUEST_FIELDS, SECRET), true)
    assert.equal(vnpayPipeVerify({ ...body, vnp_SecureHash: hash }, VNPAY_QUERYDR_REQUEST_FIELDS, "wrong"), false)
})

test("vnpay payload builders produce verifiable bodies", () => {
    const url = new URL(vnpayPayUrl("http://127.0.0.1:1", PARAMS, SECRET))
    assert.equal(url.pathname, "/paymentv2/vpcpay.html")
    const query = Object.fromEntries(url.searchParams)
    assert.equal(vnpayVerify(query, SECRET), true)

    const result = vnpayResultParams(
        { tmnCode: "DEMOV210", txnRef: "5", amount: "1000000", orderInfo: "Thanh toan don hang 5", responseCode: "00", transactionNo: "14226112", payDate: "20210801153500" },
        SECRET,
    )
    assert.equal(result["vnp_ResponseCode"], "00")
    assert.equal(result["vnp_TransactionStatus"], "00")
    assert.equal(result["vnp_SecureHashType"], "HmacSHA512")
    assert.equal(vnpayVerify(result, SECRET), true)
    const cancelled = vnpayResultParams(
        { tmnCode: "DEMOV210", txnRef: "5", amount: "1000000", orderInfo: "x", responseCode: "24", transactionNo: "0", payDate: "" },
        SECRET,
    )
    assert.equal(cancelled["vnp_TransactionStatus"], "02")
    assert.equal(vnpayVerify(cancelled, SECRET), true)

    const answer = vnpayQuerydrResponse(
        { tmnCode: "DEMOV210", txnRef: "5", amount: "1000000", orderInfo: "x", transactionNo: "1", payDate: "20210801153500", bankCode: "NCB", responseCode: "00", transactionStatus: "00" },
        "id1",
        SECRET,
    )
    assert.equal(answer["vnp_Command"], "querydr")
    assert.match(answer["vnp_SecureHash"] ?? "", /^[0-9a-f]{128}$/)
})
