import { QueryHandler } from "@nestjs/cqrs"
import { OrderService } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GetBuyerStatusResult } from "./get-buyer-status.contracts"
import { GetBuyerStatusQuery } from "./get-buyer-status.query"

@QueryHandler(GetBuyerStatusQuery)
/** Whether the caller has confirmed orders. */
export class GetBuyerStatusHandler extends ICQRSHandler<GetBuyerStatusQuery, GetBuyerStatusResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly orders: OrderService,
    ) {
        super(logger)
    }

    protected override process(query: GetBuyerStatusQuery): Promise<GetBuyerStatusResult> {
        return this.orders.buyerStatus({ personId: query.params.principal.id })
    }
}
