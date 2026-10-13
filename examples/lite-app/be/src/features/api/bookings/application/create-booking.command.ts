import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateBookingRequest, CreateBookingResult } from "./create-booking.contracts"

/** Asks to book a resource of the authenticated caller. */
export class CreateBookingCommand extends Command<CreateBookingResult> {
    constructor(readonly params: ExecuteParams<CreateBookingRequest>) {
        super()
    }
}
