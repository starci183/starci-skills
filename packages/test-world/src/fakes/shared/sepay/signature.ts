/**
 * The SePay authentication schemes.
 *
 * - Webhook (SePay docs "Tich hop Webhooks", "Xac thuc Webhooks"): SePay calls the merchant url with the header
 *   `Authorization: Apikey <key>` when the webhook is configured with API-key authentication. `sepayApiKeyHeader`.
 * - API calls of the todo integration (the existing fake of the todo example): `Authorization: Bearer <apiKey>`; the webhook
 *   of that integration is `Authorization: Bearer <webhookSecret>`. `sepayBearerHeader`.
 * - Extension (not part of SePay's documented contract): every delivery also carries `x-sepay-timestamp: <epoch ms>` and
 *   `x-sepay-signature: sha256=<hex>`, HMAC-SHA256 of `<timestamp>.<exact body>` with the webhook secret, so a consumer can
 *   verify the body AND refuse a stale delivery (a replay outside its window).
 */
import { createHmac, timingSafeEqual } from "node:crypto"

/** `Authorization` value of SePay's documented webhook authentication. */
export const sepayApiKeyHeader = (key: string): string => `Apikey ${key}`

/** `Authorization` value of the bearer scheme (API calls and the todo webhook). */
export const sepayBearerHeader = (key: string): string => `Bearer ${key}`

/** The header that carries the signing time of a delivery, epoch milliseconds. */
export const SEPAY_TIMESTAMP_HEADER = "x-sepay-timestamp"
/** The header that carries the signature of a delivery. */
export const SEPAY_SIGNATURE_HEADER = "x-sepay-signature"

/** The HMAC-SHA256 signature of `<timestamp>.<exact body>`, `sha256=<hex>`. */
export const sepaySignature = (timestamp: number, body: string, secret: string): string =>
    `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex")}`

const equal = (given: string, expected: string): boolean => {
    const a = Buffer.from(given, "utf8")
    const b = Buffer.from(expected, "utf8")
    return a.length === b.length && timingSafeEqual(a, b)
}

/** True when the `Authorization` header is `Apikey <key>`. */
export const sepayVerifyApiKey = (authorization: string | undefined, key: string): boolean =>
    authorization !== undefined && equal(authorization, sepayApiKeyHeader(key))

/** True when the `Authorization` header is `Bearer <key>`. */
export const sepayVerifyBearer = (authorization: string | undefined, key: string): boolean =>
    authorization !== undefined && equal(authorization, sepayBearerHeader(key))

/** True when `signature` signs `<timestamp>.<body>` with `secret` (the age of `timestamp` is the consumer's own window). */
export const sepayVerifySignature = (body: string, timestamp: string | undefined, signature: string | undefined, secret: string): boolean =>
    timestamp !== undefined && /^\d+$/.test(timestamp) && signature !== undefined && equal(signature, sepaySignature(Number(timestamp), body, secret))
