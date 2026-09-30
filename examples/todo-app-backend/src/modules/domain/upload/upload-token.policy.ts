import { createHmac, timingSafeEqual } from "node:crypto"
import type { SignUploadTokenParams, TokenVerdict, VerifyUploadTokenParams } from "./upload.contracts"

const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/

const signatureOf = (uploadId: string, expiresAtMs: number, secret: string): string =>
    createHmac("sha256", secret).update(`${uploadId}.${expiresAtMs}`).digest("hex")

/**
 * Mints `<expiryMs>.<hmac>`: an HMAC-SHA256 over the upload id and the expiry. The expiry travels inside the signed
 * payload, so a client cannot edit it without breaking the signature.
 */
export const signUploadToken = (params: SignUploadTokenParams): string =>
    `${params.expiresAtMs}.${signatureOf(params.uploadId, params.expiresAtMs, params.secret)}`

/** Names why a presented token is refused, or `ok`; the signature is compared in constant time. */
export const verifyUploadToken = (params: VerifyUploadTokenParams): TokenVerdict => {
    if (!params.token) return "missing"
    const dot = params.token.indexOf(".")
    if (dot <= 0) return "malformed"
    const expiresAtMs = Number(params.token.slice(0, dot))
    const presented = params.token.slice(dot + 1)
    if (!Number.isFinite(expiresAtMs) || !SIGNATURE_PATTERN.test(presented)) return "malformed"
    const expected = signatureOf(params.uploadId, expiresAtMs, params.secret)
    if (!timingSafeEqual(Buffer.from(presented, "hex"), Buffer.from(expected, "hex"))) return "signature"
    return params.nowMs > expiresAtMs ? "expired" : "ok"
}
