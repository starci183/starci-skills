import type { AccountErrorCode } from "@modules/domain/account"
import type { Outcome } from "@modules/platform/primitives"

/** What reading the caller account takes: the caller bearer token, forwarded to the order service for the buyer status. */
export interface GetAccountRequest {
    /** The bearer token the caller presented. */
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

/** The overview, or the refusal when the caller person no longer exists. */
export type GetAccountResult = Outcome<AccountOverview, AccountErrorCode.PersonUnknown>
