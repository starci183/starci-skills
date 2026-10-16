import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ResourcesGraphqlOptions } from "./resources-graphql.options"

/** The configurable-module base of the resources-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ResourcesGraphqlOptions>().setClassMethodName("register").build()
