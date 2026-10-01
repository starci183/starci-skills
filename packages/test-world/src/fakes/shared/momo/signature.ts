/**
 * The MoMo Payment Gateway v2 (All-in-One) signature scheme (MoMo developer docs: "Thanh toan qua Cong thanh toan MoMo",
 * sections "Tao giao dich" create, "IPN", "Kiem tra trang thai giao dich" query and "Hoan tien" refund).
 *
 * Every signature is HMAC-SHA256 (lower-case hex) with the partner secret key over `name=value&name=value...`: the names are
 * the fixed list of the operation, in alphabetical order (see `MOMO_*_FIELDS`), with values unencoded; a missing value is an
 * empty string.
 *
 * Note (uncertain): MoMo's create/query response signature is documented only loosely; the fake signs the create response over
 * `MOMO_CREATE_RESPONSE_FIELDS` and the query response over the IPN field list, and answers the refund unsigned like the
 * real gateway.
 */
import { createHmac, timingSafeEqual } from "node:crypto"

/** A flat MoMo body. */
export type MomoBody = object
/** Reads one key of a body. */
const field_ = (body: MomoBody, key: string): unknown => (body as Readonly<Record<string, unknown>>)[key]

/** The create request field order (`accessKey` is added from the partner options, it is not in the request body). */
export const MOMO_CREATE_REQUEST_FIELDS = [
    "accessKey",
    "amount",
    "extraData",
    "ipnUrl",
    "orderId",
    "orderInfo",
    "partnerCode",
    "redirectUrl",
    "requestId",
    "requestType",
] as const

/** The create response field order the fake signs. */
export const MOMO_CREATE_RESPONSE_FIELDS = [
    "accessKey",
    "amount",
    "message",
    "orderId",
    "partnerCode",
    "payUrl",
    "requestId",
    "responseTime",
    "resultCode",
] as const

/** The IPN (and query response) field order. */
export const MOMO_IPN_FIELDS = [
    "accessKey",
    "amount",
    "extraData",
    "message",
    "orderId",
    "orderInfo",
    "orderType",
    "partnerCode",
    "payType",
    "requestId",
    "responseTime",
    "resultCode",
    "transId",
] as const

/** The query request field order. */
export const MOMO_QUERY_REQUEST_FIELDS = ["accessKey", "orderId", "partnerCode", "requestId"] as const

/** The refund request field order. */
export const MOMO_REFUND_REQUEST_FIELDS = ["accessKey", "amount", "description", "orderId", "partnerCode", "requestId", "transId"] as const

/** The canonical string of the listed fields: `name=value&...`; values come from `body`, `accessKey` from `extra` when absent. */
export const momoCanonicalString = (body: MomoBody, fields: ReadonlyArray<string>, extra: MomoBody = {}): string =>
    fields
        .map((field) => {
            const value = field_(body, field) ?? field_(extra, field)
            return `${field}=${value === undefined || value === null ? "" : String(value)}`
        })
        .join("&")

/** HMAC-SHA256 hex of an arbitrary string. */
export const momoHmac = (data: string, secretKey: string): string => createHmac("sha256", secretKey).update(data, "utf8").digest("hex")

/** The signature of `body` for the given field order; `accessKey` is taken from `body` or from `extra`. */
export const momoSign = (body: MomoBody, fields: ReadonlyArray<string>, secretKey: string, extra: MomoBody = {}): string =>
    momoHmac(momoCanonicalString(body, fields, extra), secretKey)

/** True when `body.signature` is the signature of `fields` with `secretKey`. */
export const momoVerify = (body: MomoBody, fields: ReadonlyArray<string>, secretKey: string, extra: MomoBody = {}): boolean => {
    const given = field_(body, "signature")
    if (typeof given !== "string" || given === "") return false
    const a = Buffer.from(given.toLowerCase(), "utf8")
    const b = Buffer.from(momoSign(body, fields, secretKey, extra), "utf8")
    return a.length === b.length && timingSafeEqual(a, b)
}
