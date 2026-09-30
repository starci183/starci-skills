import type { UpcomingOccurrences, UpcomingOccurrencesRequest } from "../../application/upcoming-occurrences.contracts"
import type { UpcomingOccurrencesInput } from "./dto/upcoming-occurrences.input"
import type { UpcomingOccurrencesType } from "./dto/upcoming-occurrences.type"

/** Maps the GraphQL input to the query request. */
export const toUpcomingOccurrencesRequest = (input: UpcomingOccurrencesInput): UpcomingOccurrencesRequest => ({
    ruleId: input.ruleId,
})

/** Maps the occurrence picture to the GraphQL type. */
export const toUpcomingOccurrencesType = (upcoming: UpcomingOccurrences): UpcomingOccurrencesType => ({
    ruleId: upcoming.ruleId,
    materialised: upcoming.materialised.map((occurrence) => ({
        occurrenceId: occurrence.occurrenceId,
        localDate: occurrence.localDate,
        dueAtUtc: occurrence.dueAtUtc,
        status: occurrence.status,
    })),
    previewDates: upcoming.previewDates,
})
