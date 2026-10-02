import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BookingsRequest, BookingsResult } from "./bookings.contracts"

/** Asks to run bookings for the authenticated caller. */
export class BookingsCommand extends Command<BookingsResult> {
    constructor(readonly params: ExecuteParams<BookingsRequest>) {
        super()
    }
}
