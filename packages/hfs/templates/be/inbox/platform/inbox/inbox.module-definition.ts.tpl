import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InboxOptions } from "./inbox.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<InboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
