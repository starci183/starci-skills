import { isRecord } from "@modules/platform/primitives"

/**
 * Reads `sub` out of the payload segment of an access token, or null when the body carries no readable token or the
 * token has no subject. There is no signature check: the token was just received from the provider over the
 * transport this client trusts; a resource server verifying a token presented by a third party is another concern.
 */
export const readSubject = (body: unknown): string | null => {
    if (!isRecord(body) || typeof body.access_token !== "string") return null
    const payload = body.access_token.split(".")[1]
    if (payload === undefined) return null
    const claims = parseClaims(payload)
    return isRecord(claims) && typeof claims.sub === "string" && claims.sub !== "" ? claims.sub : null
}

/** The claims a payload segment encodes, or null when the segment is not base64url JSON. */
const parseClaims = (payload: string): unknown => {
    try {
        return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    } catch {
        return null
    }
}
