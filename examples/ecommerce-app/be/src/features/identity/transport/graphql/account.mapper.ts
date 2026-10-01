import type { AccountOverview } from "@modules/domain/account"
import type { GetAccountRequest } from "../../application/get-account.contracts"
import type { AccountType } from "./dto/account.type"

/** Maps the bearer token of the request to the query request: the token is forwarded to the order service for the buyer status. */
export const toGetAccountRequest = (sessionToken: string): GetAccountRequest => ({ sessionToken })

/** Maps the account overview to the GraphQL type. */
export const toAccountType = (overview: AccountOverview): AccountType => ({
    personId: overview.personId,
    email: overview.email,
    hasOrders: overview.hasOrders,
})
