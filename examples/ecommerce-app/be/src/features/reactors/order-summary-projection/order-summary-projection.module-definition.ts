import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderSummaryProjectionOptions } from "./order-summary-projection.options"

/** The configurable-module base of the order-summary-projection module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OrderSummaryProjectionOptions>().setClassMethodName("register").build()
