import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeaseOptions } from "./lease.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the lease capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LeaseOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How the lease module is composed: registered once at the app root and reached through injectors. */
export const LEASE_MODULE_KIND = ModuleKind.Capability
