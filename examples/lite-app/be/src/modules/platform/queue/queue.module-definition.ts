import { ConfigurableModuleBuilder } from "@nestjs/common"
import { QUEUE_OPTIONS } from "./queue.decorators"
import type { QueueOptions } from "./queue.options"

/** The configurable-module base of the queues; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<QueueOptions>({
    optionsInjectionToken: QUEUE_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
