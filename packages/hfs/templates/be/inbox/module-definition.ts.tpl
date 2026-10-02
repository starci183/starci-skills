import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Provider@@InboxOptions } from "./@@provider@@-inbox.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<@@Provider@@InboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
