import { RuleFrequency } from './calendar.util';

export interface EditRecurrenceCommandParams {
  readonly ruleId: string;
  readonly actorId: string;
  readonly frequency?: RuleFrequency;
  readonly n?: number | null;
  readonly dayOfMonth?: number | null;
  readonly timeZone?: string;
  readonly time?: string;
}

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
