import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ShareOptions } from "./share.options"

/** The configurable-module base of the share capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ShareOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
