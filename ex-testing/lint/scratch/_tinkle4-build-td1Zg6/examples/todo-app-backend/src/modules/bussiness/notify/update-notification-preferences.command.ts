/** Contract naming the update notification preferences command params shape bussiness/notify code and its consumers share; a second site never retypes it inline. */
export interface UpdateNotificationPreferencesCommandParams {
  readonly actorId: string;
  readonly channel: string;
  readonly unsubscribed?: boolean;
  readonly digestWindowMinutes?: number | null;
}

/** Contract naming the update notification preferences command result shape bussiness/notify code and its consumers share; a second site never retypes it inline. */
export interface UpdateNotificationPreferencesCommandResult {
  readonly channel: string;
  readonly unsubscribed: boolean;
  readonly digestWindowMinutes: number | null;
}

/** fr.notify.unsubscribe / data.notify.preference as a CQRS write, backing the `updateNotificationPreferences`
 * GraphQL mutation. An omitted `unsubscribed` or `digestWindowMinutes` keeps its current value. */
export class UpdateNotificationPreferencesCommand {
    constructor(readonly params: UpdateNotificationPreferencesCommandParams) {}
}
