import type { ErrorKind } from "./errors.contracts"

/** The one table from error kind to HTTP status; every transport answers a failure through it. */
export const HTTP_STATUS_BY_KIND: Readonly<Record<ErrorKind, number>> = {
    invalid: 400,
    unauthenticated: 401,
    forbidden: 403,
    "not-found": 404,
    conflict: 409,
    "rate-limited": 429,
    unavailable: 503,
    internal: 500,
}
