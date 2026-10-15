import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderStatusPushMessageOptions } from "./order-status-push-message.options"

/** The configurable-module base of the order-status-push-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OrderStatusPushMessageOptions>().setClassMethodName("register").build()
