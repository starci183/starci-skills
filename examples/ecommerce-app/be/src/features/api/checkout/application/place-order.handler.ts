import { CommandHandler } from "@nestjs/cqrs"
import { OrderService } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { PlaceOrderResult } from "./place-order.contracts"
import { PlaceOrderCommand } from "./place-order.command"

@CommandHandler(PlaceOrderCommand)
/** Places the order of the caller cart; the order service decides replay, pricing, the one transaction, the start of the place-order saga run and the announcement of `order.placed`. */
export class PlaceOrderHandler extends ICQRSHandler<PlaceOrderCommand, PlaceOrderResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly orders: OrderService,
    ) {
        super(logger)
    }

    protected override process(command: PlaceOrderCommand): Promise<PlaceOrderResult> {
        return this.orders.placeOrder({
            personId: command.params.principal.id,
            idempotencyKey: command.params.request.idempotencyKey,
        })
    }
}
