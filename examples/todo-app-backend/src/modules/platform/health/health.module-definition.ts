import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HealthOptions } from "./health.options"

/** The configurable-module base of the health capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<HealthOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
