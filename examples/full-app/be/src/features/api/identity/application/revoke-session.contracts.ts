import type { RevokedSession, SessionErrorCode } from "@modules/domain/session"
import type { Outcome } from "@modules/platform/primitives"

/** What revoking a session takes: the token to end. */
export interface RevokeSessionRequest {
    /** The opaque bearer token of the session to end; it must be the caller own. */
    readonly sessionToken: string
}

/** The confirmation, or the refusal when the token is not a live session of the caller. */
export type RevokeSessionResult = Outcome<RevokedSession, SessionErrorCode.Invalid>
