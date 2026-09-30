import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MessagingOptions } from "./messaging.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the messaging capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<MessagingOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()

/** How the messaging module is composed: registered once at the app root and reached through injectors. */
export const MESSAGING_MODULE_KIND = ModuleKind.Capability
