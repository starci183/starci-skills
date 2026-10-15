import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CliOptions } from "./cli.options"

/** The configurable-module base of the cli module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CliOptions>().setClassMethodName("register").build()
