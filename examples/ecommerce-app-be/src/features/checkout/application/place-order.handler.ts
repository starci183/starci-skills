import { CommandHandler } from "@nestjs/cqrs"
import { OrderService } from "@modules/domain/order"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { PlaceOrderResult } from "./place-order.contracts"
import { PlaceOrderCommand } from "./place-order.command"

@CommandHandler(PlaceOrderCommand)
/** Confirms the caller cart; the order service decides replay, pricing and the one transaction. */
export class PlaceOrderHandler extends ICQRSHandler<PlaceOrderCommand, PlaceOrderResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly orders: OrderService,
    ) {
        super(logger)
    }

    protected override process(command: PlaceOrderCommand): Promise<PlaceOrderResult> {
        const { request, principal } = command.params
        return this.orders.placeOrder({ personId: principal.id, idempotencyKey: request.idempotencyKey })
    }
}
