import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { {{Name}}GraphqlOptions } from "./{{name}}-graphql.options"

/** The configurable-module base of the {{name}}-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<{{Name}}GraphqlOptions>().setClassMethodName("register").build()
