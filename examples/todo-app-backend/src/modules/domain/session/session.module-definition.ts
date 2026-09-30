import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SessionOptions } from "./session.options"
import { ModuleKind } from "@modules/platform/composition"

/** The configurable-module base of the session capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SessionOptions>()
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()

/** How the session module is composed: registered once at the app root and reached through injectors. */
export const SESSION_MODULE_KIND = ModuleKind.Capability
