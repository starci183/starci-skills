import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Job@@QueueOptions } from "./@@job@@-queue.options"

/** The configurable-module base of the @@job@@-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<@@Job@@QueueOptions>().setClassMethodName("register").build()
