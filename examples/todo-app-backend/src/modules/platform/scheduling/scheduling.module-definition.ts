import { ConfigurableModuleBuilder } from "@nestjs/common"
import { SCHEDULING_OPTIONS } from "./scheduling.decorators"
import type { SchedulingOptions } from "./scheduling.options"

/** The configurable-module base of the scheduling capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SchedulingOptions>({ optionsInjectionToken: SCHEDULING_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
