import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { DatabaseOptions } from "./database.options"

/** The configurable-module base of the database capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<DatabaseOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
