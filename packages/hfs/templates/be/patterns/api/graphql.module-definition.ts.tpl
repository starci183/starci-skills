import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { @@Feature@@GraphqlOptions } from "./@@feature@@-graphql.options"

/** The configurable-module base of the @@feature@@-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<@@Feature@@GraphqlOptions>().setClassMethodName("register").build()
