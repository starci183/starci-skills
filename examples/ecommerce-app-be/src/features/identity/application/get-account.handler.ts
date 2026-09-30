import { QueryHandler } from "@nestjs/cqrs"
import { AccountService } from "@modules/domain/account"
import { InjectOrderApi } from "@modules/integrations/order-api"
import type { OrderApiClient } from "@modules/integrations/order-api"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { GetAccountResult } from "./get-account.contracts"
import { GetAccountQuery } from "./get-account.query"

@QueryHandler(GetAccountQuery)
/**
 * Joins the caller account with the buyer status read live from the order service. An unreachable order service fails
 * the query with its own error: an outage never degrades into hasOrders false, which would look like an answer.
 */
export class GetAccountHandler extends ICQRSHandler<GetAccountQuery, GetAccountResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectOrderApi() private readonly orderApi: OrderApiClient,
        private readonly accounts: AccountService,
    ) {
        super(logger)
    }

    protected override async process(query: GetAccountQuery): Promise<GetAccountResult> {
        const { request, principal } = query.params
        const account = await this.accounts.getAccount({ personId: principal.id })
        if (account.kind === "refused") return account
        const buyer = await this.orderApi.getBuyerStatus(request.sessionToken)
        return ok({ personId: account.value.personId, email: account.value.email, hasOrders: buyer.hasOrders })
    }
}
