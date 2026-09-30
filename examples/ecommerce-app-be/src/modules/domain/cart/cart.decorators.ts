import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { CartService } from "./cart.service"

/** Injects the CartService of this capability. Parameter type: CartService. */
export const InjectCartService = (): TypedParameterDecorator<CartService> => injector<CartService>(CartService)
