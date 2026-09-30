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
    const { claims } = parseClaims(payload)
    return isRecord(claims) && typeof claims.sub === "string" && claims.sub !== "" ? claims.sub : null
}

/** What a payload segment decodes to: the claims, or the cause when the segment is not base64url JSON. */
interface ParsedClaims {
    readonly claims: unknown
    readonly cause: unknown
}

/** The claims a payload segment encodes; a segment that is not base64url JSON has no claims and carries the cause. */
const parseClaims = (payload: string): ParsedClaims => {
    try {
        return { claims: JSON.parse(Buffer.from(payload, "base64url").toString("utf8")), cause: null }
    } catch (error) {
        return { claims: null, cause: error }
    }
}
