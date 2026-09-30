import type { SessionErrorCode } from "@modules/domain/session"
import type { Outcome } from "@modules/platform/primitives"

/** What signing out takes: the token of the session to end. */
export interface SignOutRequest {
    /** The bearer token of the session; it is the input, not ambient authentication, because it is what ends. */
    readonly sessionToken: string
}

/** The confirmation that the session is gone. */
export interface SignedOut {
    /** True once the session row is gone. */
    readonly signedOut: boolean
}

/** The confirmation, or the refusal that names why no live session matched the token. */
export type SignOutResult = Outcome<SignedOut, SessionErrorCode.NotFound | SessionErrorCode.Expired>
