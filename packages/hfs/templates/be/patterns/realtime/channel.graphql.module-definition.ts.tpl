import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Channel@@GraphqlOptions } from "./@@channel@@-graphql.options"

/** The configurable-module base of the @@channel@@-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<@@Channel@@GraphqlOptions>().setClassMethodName("register").build()
