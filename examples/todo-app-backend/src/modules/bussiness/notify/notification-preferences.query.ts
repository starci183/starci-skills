export interface NotificationPreferencesQueryParams {
  readonly actorId: string;
  readonly channel: string;
}

export interface NotificationPreferencesQueryResult {
  readonly channel: string;
  readonly unsubscribed: boolean;
  readonly digestWindowMinutes: number | null;
}

/** data.notify.preference as a CQRS read, backing the `notificationPreferences` GraphQL query. Reads
 * back the default (not unsubscribed, no digest-window override) when no row has ever been written. */
export class NotificationPreferencesQuery {
  constructor(readonly params: NotificationPreferencesQueryParams) {}
}
