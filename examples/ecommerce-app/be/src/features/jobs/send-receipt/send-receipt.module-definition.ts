import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { SendReceiptOptions } from "./send-receipt.options"

/** The configurable-module base of the send-receipt module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<SendReceiptOptions>().setClassMethodName("register").build()
