import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { IdsOptions } from "./ids.options"

/** The configurable-module base of the ids capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<IdsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
