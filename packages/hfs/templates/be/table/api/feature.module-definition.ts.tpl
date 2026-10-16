import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { {{Name}}ApiOptions } from "./{{name}}.options"

/** The configurable-module base of the {{name}} module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<{{Name}}ApiOptions>().setClassMethodName("register").build()
