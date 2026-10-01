import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { AppendLogLineRequest, AppendLogLineResult } from "./append-log-line.contracts"

/** Asks to append one line to the audit log; a system message, dispatched by the audit queue consumer. */
export class AppendLogLineCommand extends Command<AppendLogLineResult> {
    constructor(readonly params: PublicExecuteParams<AppendLogLineRequest>) {
        super()
    }
}
