import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { OrderExpiryTicksOptions } from "./order-expiry-ticks.options"

/** Token of the manual expiry tick configuration. */
export const ORDER_EXPIRY_TICKS_OPTIONS: unique symbol = Symbol("domain.order-expiry-ticks.options")

/** Injects the payment window of an expiry tick. */
export const InjectOrderExpiryTicksOptions = (): TypedParameterDecorator<OrderExpiryTicksOptions> =>
    injector<OrderExpiryTicksOptions>(ORDER_EXPIRY_TICKS_OPTIONS)
