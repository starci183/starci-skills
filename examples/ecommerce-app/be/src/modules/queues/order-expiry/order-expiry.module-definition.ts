import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderExpiryOptions } from "./order-expiry.options"

/** The configurable-module base of the order-expiry module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OrderExpiryOptions>().setClassMethodName("register").build()
