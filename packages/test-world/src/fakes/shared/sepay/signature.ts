/**
 * The SePay authentication schemes.
 *
 * - Webhook (SePay docs "Tich hop Webhooks", "Xac thuc Webhooks"): SePay calls the merchant url with the header
 *   `Authorization: Apikey <key>` when the webhook is configured with API-key authentication. `sepayApiKeyHeader`.
 * - API calls of the todo integration (the existing fake of the todo example): `Authorization: Bearer <apiKey>`; the webhook
 *   of that integration is `Authorization: Bearer <webhookSecret>`. `sepayBearerHeader`.
 * - Extension (not part of SePay's documented contract, kept from the todo example's "HMAC signature" wish): every delivery
 *   also carries `x-sepay-signature: sha256=<hex>`, HMAC-SHA256 of the exact body with the webhook secret, so a consumer that
 *   verifies a body signature works as well.
 */
import { createHmac, timingSafeEqual } from "node:crypto"

/** `Authorization` value of SePay's documented webhook authentication. */
export const sepayApiKeyHeader = (key: string): string => `Apikey ${key}`

/** `Authorization` value of the bearer scheme (API calls and the todo webhook). */
export const sepayBearerHeader = (key: string): string => `Bearer ${key}`

/** The HMAC-SHA256 signature of an exact body, `sha256=<hex>`. */
export const sepayBodySignature = (body: string, secret: string): string =>
    `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`

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

/** True when `signature` is the body signature with `secret`. */
export const sepayVerifyBody = (body: string, signature: string | undefined, secret: string): boolean =>
    signature !== undefined && equal(signature, sepayBodySignature(body, secret))
