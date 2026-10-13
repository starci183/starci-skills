import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateCalendarRequest, CreateCalendarResult } from "./create-calendar.contracts"

/** Asks to create one calendar row owned by the authenticated caller. */
export class CreateCalendarCommand extends Command<CreateCalendarResult> {
    constructor(readonly params: ExecuteParams<CreateCalendarRequest>) {
        super()
    }
}
