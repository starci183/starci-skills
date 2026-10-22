import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { OrderApiOptions } from "./order-api.options"
import type { OrderApiClient } from "./order-api.client"

/** Token of the order api client. */
export const ORDER_API: unique symbol = Symbol("integrations.order-api")

/** Token of the options of the order api integration, exported so a spec can provide it. */
export const ORDER_API_OPTIONS: unique symbol = Symbol("integrations.order-api.options")

/** Injects the options of the order api integration. Parameter type: OrderApiOptions. */
export const InjectOrderApiOptions = (): TypedParameterDecorator<OrderApiOptions> =>
    injector<OrderApiOptions>(ORDER_API_OPTIONS)

/** Injects the order api client. Parameter type: OrderApiClient. */
export const InjectOrderApi = (): TypedParameterDecorator<OrderApiClient> => injector<OrderApiClient>(ORDER_API)
