import {
    createHmac, timingSafeEqual 
} from "node:crypto"

/**
 * The presigned-PUT credential the local adapter hands out: an HMAC-SHA256 over the upload id plus an
 * expiry timestamp, carried as `x-upload-token` on PUT /uploads/<id>/content. This is the same idea a
 * provider presign encodes into a query string - a capability-bound, short-lived, unguessable
 * permission that needs no session - encoded as a header token because the local data plane is this
 * api's own door rather than an object store's URL. Signing material comes from
 * AppConfigService.getUploadSigningSecret (a *_FILE secret in a real deployment, a DEMO-ONLY literal
 * in this example), so the token is unforgeable by a client that can see the upload id.
 */

export const UPLOAD_TOKEN_HEADER = "x-upload-token"

/** The named outcome of verifyUploadToken - one word per refusal reason, so the door can attach the
 * reason to the exception's metadata instead of parsing a message. */
export type UploadTokenVerdict = "ok" | "missing" | "malformed" | "signature" | "expired";

/** Mints `<expiryMs>.<hmac>` - the expiry travels inside the signed payload so a client cannot edit
 * it without invalidating the signature. */
export function signUploadToken(uploadId: string, expiresAtMs: number, secret: string): string {
    const signature = hmac(uploadId,
        expiresAtMs,
        secret)
    return `${expiresAtMs}.${signature}`
}

/** Verifies a presented token against the upload id, the clock and the secret. Returns a named verdict
 * rather than throwing, so the door can map every refusal to the same house exception with a reason. */
export function verifyUploadToken(
    uploadId: string,
    token: string | undefined,
    secret: string,
    nowMs: number,
): UploadTokenVerdict {
    if (!token) return "missing"
    const dot = token.indexOf(".")
    if (dot <= 0) return "malformed"
    const expiresAtMs = Number(token.slice(0,
        dot))
    const presented = token.slice(dot + 1)
    if (!Number.isFinite(expiresAtMs) || !/^[0-9a-f]{64}$/.test(presented)) return "malformed"
    const expected = hmac(uploadId,
        expiresAtMs,
        secret)
    if (!timingSafeEqual(Buffer.from(presented,
        "hex"),
    Buffer.from(expected,
        "hex"))) return "signature"
    if (nowMs > expiresAtMs) return "expired"
    return "ok"
}

function hmac(uploadId: string, expiresAtMs: number, secret: string): string {
    return createHmac("sha256",
        secret)
        .update(`${uploadId}.${expiresAtMs}`)
        .digest("hex")
}
