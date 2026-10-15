import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SeedOptions } from "./seed.options"

/** The configurable-module base of the seed module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<SeedOptions>().setClassMethodName("register").build()
