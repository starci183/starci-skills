import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CheckoutOptions } from "./checkout.options"

/** The configurable-module base of the checkout module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<CheckoutOptions>().setClassMethodName("register").build()
