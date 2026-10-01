import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpcomingOccurrencesRequest, UpcomingOccurrencesResult } from "./upcoming-occurrences.contracts"

/** Asks for the materialised occurrences of a rule of the caller and the dates it will fire on next. */
export class UpcomingOccurrencesQuery extends Query<UpcomingOccurrencesResult> {
    constructor(readonly params: ExecuteParams<UpcomingOccurrencesRequest>) {
        super()
    }
}
