import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Channel@@WebsocketOptions } from "./@@channel@@-websocket.options"

/** The configurable-module base of the @@channel@@-websocket module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<@@Channel@@WebsocketOptions>().setClassMethodName("register").build()
