import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./order-api.module-definition"
import type { OrderApiOptions } from "./order-api.options"
import type { OrderApiClient } from "./order-api.client"

/** Token of the order api client. */
export const ORDER_API: unique symbol = Symbol("integrations.order-api")

/** Injects the options of the order api integration. Parameter type: OrderApiOptions. */
export const InjectOrderApiOptions = (): TypedParameterDecorator<OrderApiOptions> =>
    injector<OrderApiOptions>(MODULE_OPTIONS_TOKEN)

/** Injects the order api client. Parameter type: OrderApiClient. */
export const InjectOrderApi = (): TypedParameterDecorator<OrderApiClient> => injector<OrderApiClient>(ORDER_API)
