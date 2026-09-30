import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AuthOptions } from "./auth.options"

/** The configurable-module base of the auth capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AuthOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
