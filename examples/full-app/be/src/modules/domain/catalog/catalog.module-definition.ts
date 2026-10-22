import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CatalogOptions } from "./catalog.options"

/** The configurable-module base of the catalog capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CatalogOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
