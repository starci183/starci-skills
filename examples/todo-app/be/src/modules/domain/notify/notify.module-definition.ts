import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { NotifyOptions } from "./notify.options"

/** The configurable-module base of the notify capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<NotifyOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
