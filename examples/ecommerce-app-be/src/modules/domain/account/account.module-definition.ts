import { ConfigurableModuleBuilder } from "@nestjs/common"
import { ModuleKind } from "@modules/platform/composition"
import type { AccountOptions } from "./account.options"

/** The configurable-module base of the account capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AccountOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How this module is composed: stateful, registered once per app at the root. */
export const ACCOUNT_MODULE_KIND = ModuleKind.Capability
