import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SchedulingOptions } from "./scheduling.options"

/** The configurable-module base of the scheduling capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SchedulingOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
