import { Module } from "@nestjs/common"
import { CheckoutModule } from "../../checkout.module"
import { AddCartItemResolver } from "./add-cart-item.resolver"
import { BuyerStatusResolver } from "./buyer-status.resolver"
import { CartResolver } from "./cart.resolver"
import { ClearCartResolver } from "./clear-cart.resolver"
import { PlaceOrderResolver } from "./place-order.resolver"

@Module({
    imports: [CheckoutModule],
    providers: [AddCartItemResolver, ClearCartResolver, PlaceOrderResolver, CartResolver, BuyerStatusResolver],
})
/** The GraphQL transport of the checkout feature. */
export class CheckoutGraphqlModule {}
