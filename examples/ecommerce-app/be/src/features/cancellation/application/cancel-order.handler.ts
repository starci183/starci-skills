import { CommandHandler } from "@nestjs/cqrs"
import { OrderService } from "@modules/domain/order"
import type { CancelledOrder } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CancelOrderCommand } from "./cancel-order.command"

@CommandHandler(CancelOrderCommand)
/** Cancels a rejected order; the order service decides the transaction and the no-op of a redelivery. */
export class CancelOrderHandler extends ICQRSHandler<CancelOrderCommand, CancelledOrder> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly orders: OrderService,
    ) {
        super(logger)
    }

    protected override process(command: CancelOrderCommand): Promise<CancelledOrder> {
        return this.orders.cancelOrder({ orderId: command.params.request.orderId })
    }
}
