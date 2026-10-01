/** What one generation tick takes: the tick instant, in which "today" is read in the zone of each rule. */
export interface GenerateRecurrencesRequest {
    /** The tick instant. */
    readonly at: Date
}

/** What one generation tick did. */
export interface GenerateRecurrencesResult {
    /** How many occurrences were materialised, each with its task. */
    readonly materialised: number
    /** How many due occurrences were left for the next tick because their task could not be created, for example over the plan cap. */
    readonly deferred: number
}
