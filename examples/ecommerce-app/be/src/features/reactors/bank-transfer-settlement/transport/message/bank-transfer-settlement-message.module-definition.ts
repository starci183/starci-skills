import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BankTransferSettlementMessageOptions } from "./bank-transfer-settlement-message.options"

/** The configurable-module base of the bank-transfer-settlement-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BankTransferSettlementMessageOptions>().setClassMethodName("register").build()
