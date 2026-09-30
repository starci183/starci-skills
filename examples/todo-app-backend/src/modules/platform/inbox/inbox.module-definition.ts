import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InboxOptions } from "./inbox.options"

/** The configurable-module base of the inbox capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<InboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
