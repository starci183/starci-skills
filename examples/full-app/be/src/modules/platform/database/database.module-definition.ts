import { ConfigurableModuleBuilder } from "@nestjs/common"
import { DATABASE_OPTIONS } from "./database.port"
import type { DatabaseOptions } from "./database.options"

/** The configurable-module base of the database capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<DatabaseOptions>({
    optionsInjectionToken: DATABASE_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
