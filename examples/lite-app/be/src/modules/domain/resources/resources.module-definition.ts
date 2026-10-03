import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ResourcesOptions } from "./resources.options"

/** The configurable-module base of the resources capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<ResourcesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
