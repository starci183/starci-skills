import { RuleFrequency } from './calendar.util';

export interface MakeRecurringCommandParams {
  readonly ownerId: string;
  readonly title: string;
  readonly frequency: RuleFrequency;
  readonly n?: number | null;
  readonly dayOfMonth?: number | null;
  readonly timeZone: string;
  readonly time: string;
  readonly startDate: string;
}

export interface MakeRecurringCommandResult {
  readonly ruleId: string;
  readonly title: string;
  readonly frequency: RuleFrequency;
  readonly timeZone: string;
  readonly time: string;
  readonly startDate: string;
}

/** fr.recur.make-recurring as a CQRS write, dispatched by the GraphQL makeRecurring mutation resolver. */
export class MakeRecurringCommand {
  constructor(readonly params: MakeRecurringCommandParams) {}
}
