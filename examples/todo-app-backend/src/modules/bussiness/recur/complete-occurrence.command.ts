export interface CompleteOccurrenceCommandParams {
  readonly occurrenceId: string;
  readonly actorId: string;
}

export interface CompleteOccurrenceCommandResult {
  readonly occurrenceId: string;
  readonly status: string;
}

/** sds.recur.occurrence-lifecycle's t-complete transition, as a CQRS write. Not exposed over GraphQL by
 * this feature (only makeRecurring/editRecurrence/endRecurrence/upcomingOccurrences are); this handler
 * is what ac.recur.occurrence.owned-by-rule-owner.refuses-non-owner and the uat flow's "complete that
 * occurrence" step are proven against directly. */
export class CompleteOccurrenceCommand {
  constructor(readonly params: CompleteOccurrenceCommandParams) {}
}
