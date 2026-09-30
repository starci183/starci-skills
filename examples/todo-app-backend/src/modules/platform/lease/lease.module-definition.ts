import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LeaseOptions } from "./lease.options"

/** The configurable-module base of the lease capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LeaseOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
