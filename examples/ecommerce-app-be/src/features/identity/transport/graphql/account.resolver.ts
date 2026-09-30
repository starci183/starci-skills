import { Query, Resolver } from "@nestjs/graphql"
import type { QueryBus } from "@nestjs/cqrs"
import { AccountError } from "@modules/domain/account"
import { BearerToken, CurrentPrincipal } from "@modules/domain/auth"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { GetAccountQuery } from "../../application/get-account.query"
import { toAccountType, toGetAccountRequest } from "./account.mapper"
import { AccountType } from "./dto/account.type"

@Resolver()
/** GraphQL door of account: the caller own account with the live buyer status of the order service. */
export class AccountResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The account of the authenticated caller. */
    @Query(() => AccountType, { name: "account" })
    async account(@CurrentPrincipal() principal: Principal, @BearerToken() sessionToken: string): Promise<AccountType> {
        const outcome = await this.queryBus.execute(
            new GetAccountQuery({ request: toGetAccountRequest(sessionToken), principal }),
        )
        return toAccountType(unwrapOutcome(outcome, AccountError))
    }
}
