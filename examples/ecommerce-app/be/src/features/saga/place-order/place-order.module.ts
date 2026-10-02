import { Module } from "@nestjs/common"
import { CancelOrderHandler } from "./application/cancel-order.handler"
import { CompensatePlaceOrderHandler } from "./application/compensate-place-order.handler"
import { CompletePlaceOrderHandler } from "./application/complete-place-order.handler"
import { ReserveOrderCompensation } from "./compensations/reserve-order.compensation"
import { PlaceOrderSagaService } from "./place-order.saga.service"
import { ReserveOrderStep } from "./steps/reserve-order.saga-step"

@Module({
    providers: [
        CancelOrderHandler,
        CompensatePlaceOrderHandler,
        CompletePlaceOrderHandler,
        PlaceOrderSagaService,
        ReserveOrderStep,
        ReserveOrderCompensation,
    ],
})
/** The place-order saga: its orchestrator, its step and compensation, and the handlers of the commands the consumers dispatch. */
export class PlaceOrderModule {}
