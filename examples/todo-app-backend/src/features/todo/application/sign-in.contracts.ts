import type { SessionErrorCode } from "@modules/domain/session"
import type { Outcome } from "@modules/platform/primitives"

/** What signing in takes: the credential pair. */
export interface SignInRequest {
    /** The email of the account. */
    readonly email: string
    /** The password; it goes to the identity provider and nowhere else. */
    readonly password: string
}

/** The session that was opened. */
export interface SignedIn {
    /** The opaque bearer token to present as `Authorization: Bearer`. */
    readonly sessionToken: string
    /** The person the session belongs to. */
    readonly personId: string
}

/** The opened session, or the uniform refusal of the credentials, or the outage of the identity provider. */
export type SignInResult = Outcome<
    SignedIn,
    SessionErrorCode.InvalidCredentials | SessionErrorCode.ProviderUnavailable
>
