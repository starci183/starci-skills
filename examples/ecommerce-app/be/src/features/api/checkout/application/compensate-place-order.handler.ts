import { CommandHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SagaTransition } from "@modules/platform/saga"
import { PlaceOrderSagaService } from "../saga/place-order.saga.service"
import { CompensatePlaceOrderCommand } from "./compensate-place-order.command"

@CommandHandler(CompensatePlaceOrderCommand)
/** Compensates the place-order saga of a rejected order; the saga decides the fence and the no-op of a redelivery. */
export class CompensatePlaceOrderHandler extends ICQRSHandler<CompensatePlaceOrderCommand, SagaTransition> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly saga: PlaceOrderSagaService,
    ) {
        super(logger)
    }

    protected override process(command: CompensatePlaceOrderCommand): Promise<SagaTransition> {
        return this.saga.compensate(command.params.request.orderId, command.params.request.eventId)
    }
}
