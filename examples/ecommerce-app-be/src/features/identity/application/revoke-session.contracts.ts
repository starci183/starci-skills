import type { SessionErrorCode } from "@modules/domain/session"
import type { Outcome } from "@modules/platform/primitives"

/** What revoking a session takes: the token to end. */
export interface RevokeSessionRequest {
    /** The opaque bearer token of the session to end; it must be the caller own. */
    readonly sessionToken: string
}

/** The confirmation that the session ended. */
export interface Revoked {
    /** Always true: a refusal is the other half of the outcome. */
    readonly revoked: true
}

/** The confirmation, or the refusal when the token is not a live session of the caller. */
export type RevokeSessionResult = Outcome<Revoked, SessionErrorCode.Invalid>
