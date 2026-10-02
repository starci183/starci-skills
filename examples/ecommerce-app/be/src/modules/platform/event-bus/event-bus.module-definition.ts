import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { EventBusOptions } from "./event-bus.options"

/** The configurable-module base of the event bus; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<EventBusOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
