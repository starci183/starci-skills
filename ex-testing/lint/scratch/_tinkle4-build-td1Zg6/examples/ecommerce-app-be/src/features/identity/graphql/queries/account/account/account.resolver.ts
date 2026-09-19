import {
    Args, ID, Query, Resolver 
} from "@nestjs/graphql"
import {
    AccountService 
} from "@modules/bussiness/account/account.service"
import {
    OrderApiClient 
} from "@modules/integrations/order/order.client"
import {
    PersonUnknownException 
} from "@modules/platform/exceptions/errors/accounts/person-unknown"

import {
    AccountResponse 
} from "./graphql-types/response"

/**
 * GraphQL query for account - the transport of what used to be GET /accounts/:personId. The
 * account view joins the local person with buyer status read live from the order service
 * through contract.checkout.order-for-identity (modules/integrations/order). An unreachable
 * order service surfaces its own typed refusal - it never degrades into `hasOrders: false`,
 * which would make an outage look like an answer.
 */
@Resolver()
/** The account door: personId in, the person plus their live buyer status out. */
export class AccountResolver {
    constructor(
    private readonly accounts: AccountService,
    private readonly orderApi: OrderApiClient,
    ) {}

  @Query(() => AccountResponse,
      {
          name: "account",
          description: "Read one account: the person and whether the order service reports them a buyer.",
      })
    async account(@Args("personId",
        {
            type: () => ID 
        }) personId: string): Promise<AccountResponse> {
        const account = await this.accounts.getAccount(personId)
        if (!account) {
            throw new PersonUnknownException({
            })
        }
        const buyer = await this.orderApi.getBuyerStatus(personId)
        return new AccountResponse(account.personId,
            account.email,
            buyer.hasOrders)
    }
}
