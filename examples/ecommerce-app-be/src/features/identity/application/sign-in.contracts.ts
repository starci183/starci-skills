import type { AccountErrorCode } from "@modules/domain/account"
import type { IssuedSession } from "@modules/domain/session"
import type { Outcome } from "@modules/platform/primitives"

/** What signing in takes: the sign-in email and the password. */
export interface SignInRequest {
    /** The sign-in email. */
    readonly email: string
    /** The plain password. */
    readonly password: string
}

/** The new session, or the refusal that names neither half of the credentials. */
export type SignInResult = Outcome<IssuedSession, AccountErrorCode.InvalidCredentials>
