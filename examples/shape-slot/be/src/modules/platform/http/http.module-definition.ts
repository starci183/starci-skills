import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { HttpOptions } from "./http.options"

/** The app root decides whether the response deadline capability is global. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<HttpOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
