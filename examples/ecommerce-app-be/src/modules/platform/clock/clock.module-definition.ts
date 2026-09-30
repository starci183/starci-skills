import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ClockOptions } from "./clock.options"

/** The configurable-module base of the clock capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ClockOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
