import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderStatusWebsocketOptions } from "./order-status-websocket.options"

/** The configurable-module base of the order-status-websocket module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OrderStatusWebsocketOptions>().setClassMethodName("register").build()
