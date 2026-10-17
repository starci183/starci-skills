import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderExpiryCliOptions } from "./order-expiry.options"

/** The configurable-module base of the order-expiry module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OrderExpiryCliOptions>().setClassMethodName("register").build()
