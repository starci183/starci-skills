import { QueryHandler } from "@nestjs/cqrs"
import { OrderListService } from "@modules/domain/order"
import type { ListOrdersResult } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListOrdersQuery } from "./list-orders.query"

@QueryHandler(ListOrdersQuery)
/** Reads one page of the caller's orders; the order list service decides the bounds of the page and the cursor. */
export class ListOrdersHandler extends ICQRSHandler<ListOrdersQuery, ListOrdersResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly orders: OrderListService,
    ) {
        super(logger)
    }

    protected override process(query: ListOrdersQuery): Promise<ListOrdersResult> {
        return this.orders.list({ personId: query.params.principal.id, ...query.params.request })
    }
}
