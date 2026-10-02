import { CommandHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PlaceOrderSagaService } from "../saga/place-order.saga.service"
import type { PlaceOrderResult } from "./place-order.contracts"
import { PlaceOrderCommand } from "./place-order.command"

@CommandHandler(PlaceOrderCommand)
/** Places the order of the caller cart by running the place-order saga: its steps are commands, its compensation answers a failure of the invoice. */
export class PlaceOrderHandler extends ICQRSHandler<PlaceOrderCommand, PlaceOrderResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly saga: PlaceOrderSagaService,
    ) {
        super(logger)
    }

    protected override process(command: PlaceOrderCommand): Promise<PlaceOrderResult> {
        return this.saga.place(command.params)
    }
}
