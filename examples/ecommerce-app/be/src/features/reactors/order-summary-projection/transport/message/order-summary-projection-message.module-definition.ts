import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderSummaryProjectionMessageOptions } from "./order-summary-projection-message.options"

/** The configurable-module base of the order-summary-projection-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OrderSummaryProjectionMessageOptions>().setClassMethodName("register").build()
