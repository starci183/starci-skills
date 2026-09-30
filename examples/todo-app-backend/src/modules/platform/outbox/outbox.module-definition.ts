import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { OutboxOptions } from "./outbox.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the outbox capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<OutboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()

/** How the outbox module is composed: registered once at the app root and reached through injectors. */
export const OUTBOX_MODULE_KIND = ModuleKind.Capability
