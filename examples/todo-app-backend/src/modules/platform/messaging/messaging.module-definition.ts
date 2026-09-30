import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MessagingOptions } from "./messaging.options"

/** The configurable-module base of the messaging capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<MessagingOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
