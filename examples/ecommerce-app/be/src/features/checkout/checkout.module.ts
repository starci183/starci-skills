import { Module } from "@nestjs/common"
import { AddCartItemHandler } from "./application/add-cart-item.handler"
import { CancelOrderHandler } from "./application/cancel-order.handler"
import { ClearCartHandler } from "./application/clear-cart.handler"
import { CompensatePlaceOrderHandler } from "./application/compensate-place-order.handler"
import { CompletePlaceOrderHandler } from "./application/complete-place-order.handler"
import { GetBuyerStatusHandler } from "./application/get-buyer-status.handler"
import { GetCartHandler } from "./application/get-cart.handler"
import { GetOrderReceiptHandler } from "./application/get-order-receipt.handler"
import { PlaceOrderHandler } from "./application/place-order.handler"
import { ReserveOrderHandler } from "./application/reserve-order.handler"
import { ReserveOrderCompensation } from "./saga/compensations/reserve-order.compensation"
import { PlaceOrderSagaService } from "./saga/place-order.saga.service"
import { ReserveOrderStep } from "./saga/steps/reserve-order.step"

@Module({
    providers: [
        AddCartItemHandler,
        ClearCartHandler,
        PlaceOrderHandler,
        ReserveOrderHandler,
        CancelOrderHandler,
        CompensatePlaceOrderHandler,
        CompletePlaceOrderHandler,
        PlaceOrderSagaService,
        ReserveOrderStep,
        ReserveOrderCompensation,
        GetCartHandler,
        GetBuyerStatusHandler,
        GetOrderReceiptHandler,
    ],
})
/** The checkout feature: the handlers of the cart, the place-order saga with its steps and compensation, the receipt link and the buyer status. */
export class CheckoutModule {}
