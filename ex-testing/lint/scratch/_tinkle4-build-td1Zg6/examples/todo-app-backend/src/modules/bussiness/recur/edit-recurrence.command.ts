import {
    RuleFrequency 
} from "./calendar.util"

/** Contract naming the edit recurrence command params shape bussiness/recur code and its consumers share; a second site never retypes it inline. */
export interface EditRecurrenceCommandParams {
  readonly ruleId: string;
  readonly actorId: string;
  readonly frequency?: RuleFrequency;
  readonly n?: number | null;
  readonly dayOfMonth?: number | null;
  readonly timeZone?: string;
  readonly time?: string;
}

/** Contract naming the edit recurrence command result shape bussiness/recur code and its consumers share; a second site never retypes it inline. */
export interface EditRecurrenceCommandResult {
  readonly ruleId: string;
  readonly frequency: RuleFrequency;
  readonly timeZone: string;
  readonly time: string;
}

/** fr.recur.edit-rule as a CQRS write, dispatched by the GraphQL editRecurrence mutation resolver. */
export class EditRecurrenceCommand {
    constructor(readonly params: EditRecurrenceCommandParams) {}
}
