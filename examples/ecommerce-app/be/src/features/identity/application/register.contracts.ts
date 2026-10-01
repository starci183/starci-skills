import type { AccountErrorCode, AccountPersonView } from "@modules/domain/account"
import type { Outcome } from "@modules/platform/primitives"

/** What registering takes: the sign-in email and the password. */
export interface RegisterRequest {
    /** The sign-in email. */
    readonly email: string
    /** The plain password. */
    readonly password: string
}

/** The new person, or the refusal of a taken email or an unreachable identity provider. */
export type RegisterResult = Outcome<
    AccountPersonView,
    AccountErrorCode.EmailTaken | AccountErrorCode.ProviderUnavailable
>
