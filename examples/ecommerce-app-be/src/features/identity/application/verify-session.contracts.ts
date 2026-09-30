import type { LiveSession, SessionErrorCode } from "@modules/domain/session"
import type { Outcome } from "@modules/platform/primitives"

/** What verifying a session takes: the bearer token. */
export interface VerifySessionRequest {
    /** The opaque bearer token. */
    readonly sessionToken: string
}

/** The person behind a live token, or the refusal of a token no session answers. */
export type VerifySessionResult = Outcome<LiveSession, SessionErrorCode.Invalid>
