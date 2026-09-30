import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LoggingOptions } from "./logging.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the logging capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LoggingOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How the logging module is composed: registered once at the app root and reached through injectors. */
export const LOGGING_MODULE_KIND = ModuleKind.Capability
