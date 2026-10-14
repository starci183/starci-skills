import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { EventBusOptions } from "./event-bus.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<EventBusOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
