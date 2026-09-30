import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OutboxOptions } from "./outbox.options"

/** The configurable-module base of the outbox capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OutboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
