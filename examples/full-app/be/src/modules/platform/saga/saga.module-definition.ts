import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SagaOptions } from "./saga.options"

/** The configurable-module base of the saga capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SagaOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
