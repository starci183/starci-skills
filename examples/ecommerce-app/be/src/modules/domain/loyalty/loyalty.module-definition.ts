import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoyaltyOptions } from "./loyalty.options"

/** The configurable-module base of the loyalty capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LoyaltyOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
