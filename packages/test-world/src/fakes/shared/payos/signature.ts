/**
 * The payOS v2 signature scheme (payOS docs: "Tao link thanh toan" create payment link, "Webhook" and the official SDK
 * `createSignatureOfPaymentRequest` / `createSignatureFromObj`).
 *
 * Create request: HMAC-SHA256 (lower-case hex) with the checksum key over `amount=..&cancelUrl=..&description=..&orderCode=..&returnUrl=..`
 * (those five keys, alphabetical, values unencoded). Response and webhook: HMAC-SHA256 over the `data` object with its keys
 * sorted alphabetically and joined as `key=value&...`; null/undefined (and the strings "null"/"undefined") become an empty
 * string; array values are JSON-stringified with each object's keys sorted, as the official SDK does.
 */
import { createHmac, timingSafeEqual } from "node:crypto"

/** The five fields of a create request that are signed. */
export interface PayosCreateSigned {
    readonly amount: number | string
    readonly cancelUrl: string
    readonly description: string
    readonly orderCode: number | string
    readonly returnUrl: string
}

const sortedDeep = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortedDeep)
    if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {}
        for (const key of Object.keys(value).sort()) out[key] = sortedDeep((value as Record<string, unknown>)[key])
        return out
    }
    return value
}

const stringify = (value: unknown): string => {
    if (value === null || value === undefined) return ""
    if (typeof value === "string") return value === "null" || value === "undefined" ? "" : value
    if (Array.isArray(value)) return JSON.stringify(value.map(sortedDeep))
    if (typeof value === "object") return JSON.stringify(sortedDeep(value))
    return String(value)
}

/** HMAC-SHA256 hex of a string. */
export const payosHmac = (data: string, checksumKey: string): string => createHmac("sha256", checksumKey).update(data, "utf8").digest("hex")

/** The canonical string of a create request. */
export const payosCreateCanonicalString = (input: PayosCreateSigned): string =>
    `amount=${input.amount}&cancelUrl=${input.cancelUrl}&description=${input.description}&orderCode=${input.orderCode}&returnUrl=${input.returnUrl}`

/** The signature of a create request. */
export const payosSignCreate = (input: PayosCreateSigned, checksumKey: string): string => payosHmac(payosCreateCanonicalString(input), checksumKey)

/** The canonical string of a `data` object (response and webhook): keys sorted, `key=value` joined by `&`. */
export const payosDataCanonicalString = (data: object): string =>
    Object.keys(data)
        .sort()
        .map((key) => `${key}=${stringify((data as Readonly<Record<string, unknown>>)[key])}`)
        .join("&")

/** The signature of a `data` object. */
export const payosSignData = (data: object, checksumKey: string): string => payosHmac(payosDataCanonicalString(data), checksumKey)

const equal = (given: string, expected: string): boolean => {
    const a = Buffer.from(given.toLowerCase(), "utf8")
    const b = Buffer.from(expected, "utf8")
    return a.length === b.length && timingSafeEqual(a, b)
}

/** True when `signature` signs the create request fields. */
export const payosVerifyCreate = (input: PayosCreateSigned, signature: string, checksumKey: string): boolean =>
    equal(signature, payosSignCreate(input, checksumKey))

/** True when `signature` signs the `data` object. */
export const payosVerifyData = (data: object, signature: string, checksumKey: string): boolean =>
    equal(signature, payosSignData(data, checksumKey))
