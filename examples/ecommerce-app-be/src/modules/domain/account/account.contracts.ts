import type { EntityManager } from "typeorm"

/** The person a successful credential check or registration names. */
export interface AccountPersonView {
    /** The person id. */
    readonly personId: string
}

/** The account view a person can read: the id and the email they registered with, never the hash. */
export interface AccountView {
    /** The person id. */
    readonly personId: string
    /** The sign-in email. */
    readonly email: string
}

/** What checking credentials needs. */
export interface VerifyCredentialsParams {
    /** The email. */
    readonly email: string
    /** The plain password. */
    readonly password: string
}

/** What registering needs; the write joins the caller transaction. */
export interface RegisterPersonParams extends VerifyCredentialsParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
}

/** What reading one account needs. */
export interface GetAccountParams {
    /** The person id. */
    readonly personId: string
}
