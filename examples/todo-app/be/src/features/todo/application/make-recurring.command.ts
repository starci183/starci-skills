import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MakeRecurringRequest, MakeRecurringResult } from "./make-recurring.contracts"

/** Asks to create a recurrence rule owned by the caller. */
export class MakeRecurringCommand extends Command<MakeRecurringResult> {
    constructor(readonly params: ExecuteParams<MakeRecurringRequest>) {
        super()
    }
}
