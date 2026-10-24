import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Channel@@SseOptions } from "./@@channel@@-sse.options"

/** The configurable-module base of the @@channel@@-sse module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<@@Channel@@SseOptions>().setClassMethodName("register").build()
