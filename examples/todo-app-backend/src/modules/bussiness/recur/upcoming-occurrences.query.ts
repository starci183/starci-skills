export interface UpcomingOccurrencesQueryParams {
  readonly ruleId: string;
  readonly actorId: string;
  /** How many days ahead (from now, in the rule's own zone) the live preview looks. Defaults to 14. */
  readonly previewDays?: number;
}

export interface MaterialisedOccurrenceSummary {
  readonly occurrenceId: string;
  readonly localDate: string;
  readonly dueAtUtc: string;
  readonly status: string;
}

export interface UpcomingOccurrencesQueryResult {
  readonly ruleId: string;
  /** Every occurrence already materialised for this rule, with its status. */
  readonly materialised: MaterialisedOccurrenceSummary[];
  /** The dates the rule will next fire on, computed live from the rule - never a promise a row exists
   * yet. Empty for an ended rule (fr.recur.see-upcoming: "shows no upcoming preview, only its history"). */
  readonly previewDates: string[];
}

/** fr.recur.see-upcoming as a CQRS read, dispatched by the GraphQL upcomingOccurrences query resolver. */
export class UpcomingOccurrencesQuery {
  constructor(readonly params: UpcomingOccurrencesQueryParams) {}
}
