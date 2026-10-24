import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { OrderOptions } from "./order.options"

/** Token of the options of the order capability, exported so a spec can provide it. */
export const ORDER_OPTIONS: unique symbol = Symbol("domain.order.options")

/** Injects the options of the order capability. Parameter type: OrderOptions. */
export const InjectOrderOptions = (): TypedParameterDecorator<OrderOptions> => injector<OrderOptions>(ORDER_OPTIONS)
