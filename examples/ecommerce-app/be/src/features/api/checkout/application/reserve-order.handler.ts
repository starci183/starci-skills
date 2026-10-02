import { CommandHandler } from "@nestjs/cqrs"
import { OrderService } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { PlaceOrderResult } from "./place-order.contracts"
import { ReserveOrderCommand } from "./reserve-order.command"

@CommandHandler(ReserveOrderCommand)
/** Confirms the caller cart; the order service decides replay, pricing, the one transaction and the start of the saga run. */
export class ReserveOrderHandler extends ICQRSHandler<ReserveOrderCommand, PlaceOrderResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly orders: OrderService,
    ) {
        super(logger)
    }

    protected override process(command: ReserveOrderCommand): Promise<PlaceOrderResult> {
        return this.orders.placeOrder({
            personId: command.params.principal.id,
            idempotencyKey: command.params.request.idempotencyKey,
        })
    }
}
