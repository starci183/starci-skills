import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { TaskOptions } from "./task.options"

/** The configurable-module base of the task capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<TaskOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
