import {
    DynamicModule 
} from "@nestjs/common"
import {
    CartSingleQueryModule 
} from "./cart/cart/cart.module"

/** Every GraphQL query module the checkout API exposes, gathered exactly like
 * todo-app-backend's `queries/index.ts` gathers `QUERY_MODULES`. */
export const QUERY_MODULES: Array<DynamicModule | (new () => unknown)> = [
    CartSingleQueryModule.register({
    }),
]
