import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderSummaryOptions } from "./order-summary.options"

/** The configurable-module base of the order-summary projection; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OrderSummaryOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
