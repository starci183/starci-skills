/** Contract naming the end recurrence command params shape bussiness/recur code and its consumers share; a second site never retypes it inline. */
export interface EndRecurrenceCommandParams {
  readonly ruleId: string;
  readonly actorId: string;
  /** The local calendar date (YYYY-MM-DD) the rule ends effective, in the rule's own time zone. */
  readonly endedAt: string;
}

/** Contract naming the end recurrence command result shape bussiness/recur code and its consumers share; a second site never retypes it inline. */
export interface EndRecurrenceCommandResult {
  readonly ruleId: string;
  readonly endedAt: string;
  readonly orphanedCount: number;
}

/** fr.recur.end-rule as a CQRS write, dispatched by the GraphQL endRecurrence mutation resolver. */
export class EndRecurrenceCommand {
    constructor(readonly params: EndRecurrenceCommandParams) {}
}
