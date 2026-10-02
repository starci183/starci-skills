import { CommandHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SagaTransition } from "@modules/platform/saga"
import { PlaceOrderSagaService } from "../saga/place-order.saga.service"
import { CompletePlaceOrderCommand } from "./complete-place-order.command"

@CommandHandler(CompletePlaceOrderCommand)
/** Completes the place-order saga of an invoiced order; the saga decides the fence and the no-op of a redelivery. */
export class CompletePlaceOrderHandler extends ICQRSHandler<CompletePlaceOrderCommand, SagaTransition> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly saga: PlaceOrderSagaService,
    ) {
        super(logger)
    }

    protected override process(command: CompletePlaceOrderCommand): Promise<SagaTransition> {
        return this.saga.complete(command.params.request.orderId, command.params.request.eventId)
    }
}
