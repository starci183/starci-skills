import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetBookingStatusRequest, GetBookingStatusResult } from "./get-booking-status.contracts"

/** Asks for the confirmation status of one booking the authenticated caller owns. */
export class GetBookingStatusQuery extends Query<GetBookingStatusResult> {
    constructor(readonly params: ExecuteParams<GetBookingStatusRequest>) {
        super()
    }
}
