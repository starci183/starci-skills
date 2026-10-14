import { ConfigurableModuleBuilder } from "@nestjs/common"
import { DATABASE_OPTIONS } from "./database.port"
import type { DatabaseOptions } from "./database.options"

/** The database capability is local unless its app or test composition makes it global. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<DatabaseOptions>({
    optionsInjectionToken: DATABASE_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({
        ...definition,
        global: extras.isGlobal,
    }))
    .build()
