import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ExpireOrdersOptions } from "./expire-orders.options"

/** The configurable-module base of the expire-orders module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ExpireOrdersOptions>().setClassMethodName("register").build()
