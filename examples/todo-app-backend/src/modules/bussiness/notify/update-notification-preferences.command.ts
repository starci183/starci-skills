export interface UpdateNotificationPreferencesCommandParams {
  readonly actorId: string;
  readonly channel: string;
  readonly unsubscribed?: boolean;
  readonly digestWindowMinutes?: number | null;
}

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
