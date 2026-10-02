import { Command } from "@nestjs/cqrs"
import type { Principal } from "@modules/domain/identity"
import type { BookingsRequest, BookingsResult } from "./bookings.contracts"

/** Asks to run bookings for the authenticated caller. */
export class BookingsCommand extends Command<BookingsResult> {
    constructor(readonly params: { readonly request: BookingsRequest; readonly principal: Principal }) {
        super()
    }
}
