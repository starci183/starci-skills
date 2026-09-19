/** Contract naming the notification preferences query params shape bussiness/notify code and its consumers share; a second site never retypes it inline. */
export interface NotificationPreferencesQueryParams {
  readonly actorId: string;
  readonly channel: string;
}

/** Contract naming the notification preferences query result shape bussiness/notify code and its consumers share; a second site never retypes it inline. */
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
