import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { CartService } from "./cart.service"

/** Token of the CartService of this capability, for the capabilities that use it. */
export const CART_SERVICE: unique symbol = Symbol("domain.cart.service")

/** Injects the CartService. Parameter type: CartService. */
export const InjectCartService = (): TypedParameterDecorator<CartService> => injector<CartService>(CART_SERVICE)
