import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { IdentityGraphqlOptions } from "./identity-graphql.options"

/** The configurable-module base of the identity-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<IdentityGraphqlOptions>().setClassMethodName("register").build()
