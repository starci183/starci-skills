import { ConfigurableModuleBuilder } from "@nestjs/common"
import { MESSAGING_OPTIONS } from "./messaging.decorators"
import type { MessagingOptions } from "./messaging.options"

/** The configurable-module base of the messaging capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<MessagingOptions>({
    optionsInjectionToken: MESSAGING_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
