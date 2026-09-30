import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RecurOptions } from "./recur.options"

/** The configurable-module base of the recur capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<RecurOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
