import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CartOptions } from "./cart.options"

/** The configurable-module base of the cart capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CartOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
