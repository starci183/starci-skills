import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { EditRecurrenceRequest, EditRecurrenceResult } from "./edit-recurrence.contracts"

/** Asks to change a recurrence rule owned by the caller. */
export class EditRecurrenceCommand extends Command<EditRecurrenceResult> {
    constructor(readonly params: ExecuteParams<EditRecurrenceRequest>) {
        super()
    }
}
