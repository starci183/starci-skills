import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SettleBankTransferRequest } from "./settle-bank-transfer.contracts"

/** Asks to apply one delivered bank-transfer-received event; the bank-transfer-received consumer sends it for every delivery. */
export class SettleBankTransferCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<SettleBankTransferRequest>) {
        super()
    }
}
