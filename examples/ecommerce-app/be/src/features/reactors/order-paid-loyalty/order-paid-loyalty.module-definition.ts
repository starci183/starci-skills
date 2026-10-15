import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderPaidLoyaltyOptions } from "./order-paid-loyalty.options"

/** The configurable-module base of the order-paid-loyalty module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OrderPaidLoyaltyOptions>().setClassMethodName("register").build()
