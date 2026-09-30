import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { EndRecurrenceRequest, EndRecurrenceResult } from "./end-recurrence.contracts"

/** Asks to end a recurrence rule owned by the caller. */
export class EndRecurrenceCommand extends Command<EndRecurrenceResult> {
    constructor(readonly params: ExecuteParams<EndRecurrenceRequest>) {
        super()
    }
}
