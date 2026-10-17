import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SepayOptions } from "./sepay.options"

/** The configurable-module base of the SePay integration. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SepayOptions>().setClassMethodName("register").build()
