import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PlaceOrderOptions } from "./place-order.options"

/** The configurable-module base of the place-order module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PlaceOrderOptions>().setClassMethodName("register").build()
