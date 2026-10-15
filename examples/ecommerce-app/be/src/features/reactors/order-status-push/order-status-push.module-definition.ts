import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderStatusPushOptions } from "./order-status-push.options"

/** The configurable-module base of the order-status-push module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OrderStatusPushOptions>().setClassMethodName("register").build()
