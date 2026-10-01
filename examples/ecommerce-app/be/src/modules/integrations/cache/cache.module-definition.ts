import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CacheOptions } from "./cache.options"

/** The configurable-module base of the cache integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CacheOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
