import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HttpSecurityOptions } from "./http-security.options"

/** The configurable-module base of the http-security capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<HttpSecurityOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
