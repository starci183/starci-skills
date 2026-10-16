import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SepayHttpOptions } from "./sepay-http.options"

/** The configurable-module base of the sepay-http module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SepayHttpOptions>().setClassMethodName("register").build()
