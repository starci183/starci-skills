import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CqrsOptions } from "./cqrs.options"

/** The configurable-module base of the cqrs capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CqrsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
