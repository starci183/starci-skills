import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { LedgerOptions } from "./ledger.options"

/** The configurable-module base of the ledger capability (fixture). */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<LedgerOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
