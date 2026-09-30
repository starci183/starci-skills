import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoggingOptions } from "./logging.options"

/** The configurable-module base of the logging capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LoggingOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
