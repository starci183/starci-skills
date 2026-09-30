import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { GraphqlOptions } from "./graphql.options"

/** The configurable-module base of the graphql capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<GraphqlOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
