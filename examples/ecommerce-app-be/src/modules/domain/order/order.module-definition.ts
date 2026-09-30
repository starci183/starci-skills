import { ConfigurableModuleBuilder } from "@nestjs/common"
import { ModuleKind } from "@modules/platform/composition"
import type { OrderOptions } from "./order.options"

/** The configurable-module base of the order capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OrderOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How this module is composed: stateful, registered once per app at the root. */
export const ORDER_MODULE_KIND = ModuleKind.Capability
