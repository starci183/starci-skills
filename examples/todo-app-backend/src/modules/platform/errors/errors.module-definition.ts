import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ErrorsOptions } from "./errors.options"

/** The configurable-module base of the errors capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ErrorsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
