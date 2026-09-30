import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { AccountOptions } from "./account.options"

/** The configurable-module base of the account capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<AccountOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
