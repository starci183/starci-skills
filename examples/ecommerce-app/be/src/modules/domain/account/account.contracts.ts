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

/** The pair a shopper registers or signs in with; the password goes to the identity provider and is never stored. */
export interface AccountCredentials {
    /** The email. */
    readonly email: string
    /** The plain password. */
    readonly password: string
}

/** What reading one account needs. */
export interface GetAccountParams {
    /** The person id. */
    readonly personId: string
}

/** What reading the account overview needs. */
export interface AccountOverviewParams extends GetAccountParams {
    /** The bearer token of the caller, forwarded to the order service for the buyer status. */
    readonly sessionToken: string
}

/** The account joined with the live buyer status read from the order service. */
export interface AccountOverview {
    /** The person id. */
    readonly personId: string
    /** The sign-in email. */
    readonly email: string
    /** True when the order service reports confirmed orders. */
    readonly hasOrders: boolean
}
