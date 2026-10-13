import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetCalendarRequest, GetCalendarResult } from "./get-calendar.contracts"

/** Asks for one calendar row the authenticated caller owns. */
export class GetCalendarQuery extends Query<GetCalendarResult> {
    constructor(readonly params: ExecuteParams<GetCalendarRequest>) {
        super()
    }
}
