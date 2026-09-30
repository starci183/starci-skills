import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { GraphqlOptions } from "./graphql.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the graphql capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<GraphqlOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How the graphql module is composed: registered once at the app root and reached through injectors. */
export const GRAPHQL_MODULE_KIND = ModuleKind.Capability
