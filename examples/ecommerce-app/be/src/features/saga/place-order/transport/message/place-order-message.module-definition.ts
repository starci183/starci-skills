import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PlaceOrderMessageOptions } from "./place-order-message.options"

/** The configurable-module base of the place-order-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PlaceOrderMessageOptions>().setClassMethodName("register").build()
