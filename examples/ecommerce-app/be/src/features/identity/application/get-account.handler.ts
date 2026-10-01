import { QueryHandler } from "@nestjs/cqrs"
import { AccountService } from "@modules/domain/account"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetAccountResult } from "./get-account.contracts"
import { GetAccountQuery } from "./get-account.query"

@QueryHandler(GetAccountQuery)
/** The caller account joined with the live buyer status; the account service owns the join and its failure rules. */
export class GetAccountHandler extends ICQRSHandler<GetAccountQuery, GetAccountResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: AccountService,
    ) {
        super(logger)
    }

    protected override process(query: GetAccountQuery): Promise<GetAccountResult> {
        return this.accounts.overview({
            personId: query.params.principal.id,
            sessionToken: query.params.request.sessionToken,
        })
    }
}
