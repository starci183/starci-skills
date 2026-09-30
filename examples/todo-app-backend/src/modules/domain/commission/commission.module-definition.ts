import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CommissionOptions } from "./commission.options"

/** The configurable-module base of the commission capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CommissionOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
