import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { MemberOptions } from "./member.options"

/** The configurable-module base of the member capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<MemberOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
