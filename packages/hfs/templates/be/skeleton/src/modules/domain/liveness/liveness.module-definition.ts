import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LivenessOptions } from "./liveness.options"

/** The configurable-module base of the liveness capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LivenessOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
