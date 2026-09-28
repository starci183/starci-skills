import {
    DynamicModule 
} from "@nestjs/common"
import {
    AddCartItemSingleMutationModule 
} from "./cart/add-cart-item/add-cart-item.module"
import {
    ClearCartSingleMutationModule 
} from "./cart/clear-cart/clear-cart.module"
import {
    PlaceOrderSingleMutationModule 
} from "./order/place-order/place-order.module"

/** Every GraphQL mutation module the checkout API exposes, gathered exactly like
 * todo-app-backend's `mutations/index.ts` gathers `MUTATION_MODULES`. */
export const MUTATION_MODULES: Array<DynamicModule | (new () => unknown)> = [
    AddCartItemSingleMutationModule.register({
    }),
    ClearCartSingleMutationModule.register({
    }),
    PlaceOrderSingleMutationModule.register({
    }),
]
