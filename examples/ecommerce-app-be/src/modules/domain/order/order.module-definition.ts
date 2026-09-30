import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OrderOptions } from "./order.options"

/** The configurable-module base of the order capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OrderOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
