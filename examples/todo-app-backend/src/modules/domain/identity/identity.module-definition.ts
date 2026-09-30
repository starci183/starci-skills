import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { IdentityOptions } from "./identity.options"

/** The configurable-module base of the session capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<IdentityOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
