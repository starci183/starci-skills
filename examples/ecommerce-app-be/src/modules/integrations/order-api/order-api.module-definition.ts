import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderApiOptions } from "./order-api.options"

/** The configurable-module base of the order api integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OrderApiOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
