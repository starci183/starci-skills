import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Name@@Options } from "./@@name@@.options"

/** The configurable-module base of the @@name@@ projection; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<@@Name@@Options>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
