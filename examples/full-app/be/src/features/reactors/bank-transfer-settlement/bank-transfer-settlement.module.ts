import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./bank-transfer-settlement.module-definition"
import { SettleBankTransferHandler } from "./application/settle-bank-transfer.handler"

@Module({ providers: [SettleBankTransferHandler] })
/** The bank-transfer-settlement reactor: the handler its consumers dispatch to. */
export class BankTransferSettlementModule extends ConfigurableModuleClass {}
