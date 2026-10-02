import { Module } from "@nestjs/common"
import { AddCartItemHandler } from "./application/add-cart-item.handler"
import { ClearCartHandler } from "./application/clear-cart.handler"
import { GetBuyerStatusHandler } from "./application/get-buyer-status.handler"
import { GetCartHandler } from "./application/get-cart.handler"
import { GetOrderReceiptHandler } from "./application/get-order-receipt.handler"
import { PlaceOrderHandler } from "./application/place-order.handler"

@Module({
    providers: [
        AddCartItemHandler,
        ClearCartHandler,
        PlaceOrderHandler,
        GetCartHandler,
        GetBuyerStatusHandler,
        GetOrderReceiptHandler,
    ],
})
/** The checkout feature: the handlers of the cart, the order confirmation, the receipt link and the buyer status. */
export class CheckoutModule {}
