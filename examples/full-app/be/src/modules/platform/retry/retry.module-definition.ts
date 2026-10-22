import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RetryOptions } from "./retry.options"

/** The configurable-module base of the retry capability; the app root decides its global scope. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<RetryOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
