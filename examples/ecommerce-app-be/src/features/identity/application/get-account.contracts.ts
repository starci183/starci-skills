import type { AccountErrorCode, AccountOverview } from "@modules/domain/account"
import type { Outcome } from "@modules/platform/primitives"

/** What reading the caller account takes: the caller bearer token, forwarded to the order service for the buyer status. */
export interface GetAccountRequest {
    /** The bearer token the caller presented. */
    readonly sessionToken: string
}

/** The overview, or the refusal when the caller person no longer exists. */
export type GetAccountResult = Outcome<AccountOverview, AccountErrorCode.PersonUnknown>

export type { AccountOverview }
