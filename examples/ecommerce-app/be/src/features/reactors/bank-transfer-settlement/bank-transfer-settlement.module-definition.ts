import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BankTransferSettlementOptions } from "./bank-transfer-settlement.options"

/** The configurable-module base of the bank-transfer-settlement module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<BankTransferSettlementOptions>().setClassMethodName("register").build()
