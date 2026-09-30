import { ConfigurableModuleBuilder } from "@nestjs/common"
import { PROBES_OPTIONS } from "./probes.decorators"
import type { ProbesOptions } from "./probes.options"

/** The configurable-module base of the probes capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ProbesOptions>({ optionsInjectionToken: PROBES_OPTIONS })
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
