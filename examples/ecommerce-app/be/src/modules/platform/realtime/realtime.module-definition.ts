import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RealtimeOptions } from "./realtime.options"

/** The configurable-module base of the realtime capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<RealtimeOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
