import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the cache integration. */
export enum CacheErrorCode {
    /** The cache store could not be reached or did not answer in time. */
    Unavailable = "CACHE_UNAVAILABLE",
    /** The store answered with a value that is not JSON. */
    ReplyUnreadable = "CACHE_REPLY_UNREADABLE",
}

/** How each cache code travels. */
export const CACHE_ERROR_KINDS: Record<CacheErrorCode, ErrorKind> = {
    [CacheErrorCode.Unavailable]: "unavailable",
    [CacheErrorCode.ReplyUnreadable]: "internal",
}

/** The one error class of the cache integration. */
export class CacheError extends DomainError<CacheErrorCode> {}
