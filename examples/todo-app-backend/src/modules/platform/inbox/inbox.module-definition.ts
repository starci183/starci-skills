import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InboxOptions } from "./inbox.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the inbox capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<InboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How the inbox module is composed: registered once at the app root and reached through injectors. */
export const INBOX_MODULE_KIND = ModuleKind.Capability
