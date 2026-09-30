import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { MODULE_OPTIONS_TOKEN } from "./order-api.module-definition"
import type { OrderApiOptions } from "./order-api.options"
import type { OrderApiClient } from "./order-api.client"

/** Token of the options of this capability, the token its configurable module provides them under. */
export const ORDER_API_OPTIONS: typeof MODULE_OPTIONS_TOKEN = MODULE_OPTIONS_TOKEN

/** Token of the order api client. */
export const ORDER_API: unique symbol = Symbol("integrations.order-api")

/** Injects the options of the order api integration. Parameter type: OrderApiOptions. */
export const InjectOrderApiOptions = (): TypedParameterDecorator<OrderApiOptions> =>
    injector<OrderApiOptions>(ORDER_API_OPTIONS)

/** Injects the order api client. Parameter type: OrderApiClient. */
export const InjectOrderApi = (): TypedParameterDecorator<OrderApiClient> => injector<OrderApiClient>(ORDER_API)
