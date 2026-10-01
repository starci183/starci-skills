/**
 * The VNPAY-PAY 2.1.0 signature scheme (VNPAY integration guide "VNPAY-PAY", sections "Tao URL thanh toan", "IPN URL",
 * "API truy van ket qua thanh toan (querydr)" and "API hoan tien (refund)").
 *
 * Payment URL, return URL and IPN: every `vnp_*` parameter except `vnp_SecureHash` and `vnp_SecureHashType` is sorted by key
 * (ascending, byte order); the string to sign is `key=urlencode(value)&key=urlencode(value)...` (spaces encoded as `+`, the
 * way the reference PHP/Node samples of VNPAY do); `vnp_SecureHash` is HMAC-SHA512 (lower-case hex) of it with the merchant
 * hash secret. Parameters whose value is empty are skipped (as the reference samples do).
 *
 * querydr and refund (`/merchant_webapi/api/transaction`, JSON body): `vnp_SecureHash` is HMAC-SHA512 over the field values
 * joined by `|` in the order the documentation lists them (see the `VNPAY_*_FIELDS` constants).
 */
import { createHmac, timingSafeEqual } from "node:crypto"

/** The query parameters of a VNPAY call. */
export type VnpayParams = Readonly<Record<string, string | number | undefined>>

/** The `vnp_*` keys never part of the string to sign. */
const EXCLUDED = new Set(["vnp_SecureHash", "vnp_SecureHashType"])

/** VNPAY url-encoding: `encodeURIComponent` with `+` for spaces, as the reference samples do. */
export const vnpayEncode = (value: string): string => encodeURIComponent(value).replace(/%20/g, "+")

/** The parameters that take part in the signature: sorted, without empty values and without the hash keys. */
export const vnpaySortedEntries = (params: VnpayParams): ReadonlyArray<readonly [string, string]> => {
    const entries: Array<readonly [string, string]> = []
    for (const [key, value] of Object.entries(params)) {
        if (EXCLUDED.has(key) || value === undefined || String(value) === "") continue
        entries.push([key, String(value)])
    }
    return entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

/** The canonical string VNPAY signs for a payment URL, return URL or IPN: `key=urlencoded&...` sorted by key. */
export const vnpayCanonicalString = (params: VnpayParams): string =>
    vnpaySortedEntries(params)
        .map(([key, value]) => `${key}=${vnpayEncode(value)}`)
        .join("&")

const hmacSha512 = (data: string, secret: string): string => createHmac("sha512", secret).update(data, "utf8").digest("hex")

/** `vnp_SecureHash` of a payment URL, return URL or IPN query. */
export const vnpaySign = (params: VnpayParams, hashSecret: string): string => hmacSha512(vnpayCanonicalString(params), hashSecret)

/** Constant-time equality of two signatures (case-insensitive: VNPAY hashes are hex). */
export const signaturesEqual = (given: string, expected: string): boolean => {
    const a = Buffer.from(given.toLowerCase(), "utf8")
    const b = Buffer.from(expected.toLowerCase(), "utf8")
    return a.length === b.length && timingSafeEqual(a, b)
}

/** True when `vnp_SecureHash` of `params` is the signature with `hashSecret`. */
export const vnpayVerify = (params: VnpayParams, hashSecret: string): boolean => {
    const given = params["vnp_SecureHash"]
    return typeof given === "string" && given !== "" && signaturesEqual(given, vnpaySign(params, hashSecret))
}

/** The request field order of querydr (`vnp_Command=querydr`). */
export const VNPAY_QUERYDR_REQUEST_FIELDS = [
    "vnp_RequestId",
    "vnp_Version",
    "vnp_Command",
    "vnp_TmnCode",
    "vnp_TxnRef",
    "vnp_TransactionDate",
    "vnp_CreateDate",
    "vnp_IpAddr",
    "vnp_OrderInfo",
] as const

/** The request field order of refund (`vnp_Command=refund`). */
export const VNPAY_REFUND_REQUEST_FIELDS = [
    "vnp_RequestId",
    "vnp_Version",
    "vnp_Command",
    "vnp_TmnCode",
    "vnp_TransactionType",
    "vnp_TxnRef",
    "vnp_Amount",
    "vnp_TransactionNo",
    "vnp_TransactionDate",
    "vnp_CreateBy",
    "vnp_CreateDate",
    "vnp_IpAddr",
    "vnp_OrderInfo",
] as const

/** The response field order of querydr. */
export const VNPAY_QUERYDR_RESPONSE_FIELDS = [
    "vnp_ResponseId",
    "vnp_Command",
    "vnp_ResponseCode",
    "vnp_Message",
    "vnp_TmnCode",
    "vnp_TxnRef",
    "vnp_Amount",
    "vnp_BankCode",
    "vnp_PayDate",
    "vnp_TransactionNo",
    "vnp_TransactionType",
    "vnp_TransactionStatus",
    "vnp_OrderInfo",
    "vnp_PromotionCode",
    "vnp_PromotionAmount",
] as const

/** The response field order of refund. */
export const VNPAY_REFUND_RESPONSE_FIELDS = [
    "vnp_ResponseId",
    "vnp_Command",
    "vnp_ResponseCode",
    "vnp_Message",
    "vnp_TmnCode",
    "vnp_TxnRef",
    "vnp_Amount",
    "vnp_BankCode",
    "vnp_PayDate",
    "vnp_TransactionNo",
    "vnp_TransactionType",
    "vnp_TransactionStatus",
    "vnp_OrderInfo",
] as const

/** A JSON body of the merchant web api (querydr, refund). */
export type VnpayBody = Readonly<Record<string, unknown>>

/** The pipe-joined string of the listed fields (a missing field is an empty string). */
export const vnpayPipeString = (body: VnpayBody, fields: ReadonlyArray<string>): string =>
    fields
        .map((field) => {
            const value = body[field]
            return value === undefined || value === null ? "" : String(value)
        })
        .join("|")

/** `vnp_SecureHash` of a querydr/refund body (request or response) for the given field order. */
export const vnpayPipeSign = (body: VnpayBody, fields: ReadonlyArray<string>, hashSecret: string): string =>
    hmacSha512(vnpayPipeString(body, fields), hashSecret)

/** True when `vnp_SecureHash` of `body` is the pipe signature of `fields` with `hashSecret`. */
export const vnpayPipeVerify = (body: VnpayBody, fields: ReadonlyArray<string>, hashSecret: string): boolean => {
    const given = body["vnp_SecureHash"]
    return typeof given === "string" && given !== "" && signaturesEqual(given, vnpayPipeSign(body, fields, hashSecret))
}
