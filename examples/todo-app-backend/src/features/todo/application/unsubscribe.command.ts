import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UnsubscribeRequest, UnsubscribeResult } from "./unsubscribe.contracts"

/** Asks to stop receiving notifications on one channel. */
export class UnsubscribeCommand extends Command<UnsubscribeResult> {
    constructor(readonly params: ExecuteParams<UnsubscribeRequest>) {
        super()
    }
}
