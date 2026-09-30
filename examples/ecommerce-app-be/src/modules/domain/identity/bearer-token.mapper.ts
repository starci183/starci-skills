const BEARER_PREFIX = "Bearer "

/** The token of an `Authorization: Bearer <token>` header value, or null when the header is absent or not a bearer credential. */
export const bearerTokenOf = (authorization: string | undefined): string | null => {
    if (authorization === undefined || !authorization.startsWith(BEARER_PREFIX)) return null
    const token = authorization.slice(BEARER_PREFIX.length).trim()
    return token === "" ? null : token
}
