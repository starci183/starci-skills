import { graphql, type Result } from '@/modules/api/graphql';
import { signOut } from '@/modules/api/auth';

/**
 * The notify feature's transport adapter: the GraphQL documents the backend already serves
 * (`notificationPreferences`, `updateNotificationPreferences` and `unsubscribe`, the three
 * operations the backend's notify resolvers serve) plus the one session call Sign out needs. It lives
 * beside the blocks rather than under `src/modules/api/` because this lane's write ceiling is
 * `src/components/notify/**`; the call/unwrap idiom is unchanged from `modules/api/tasks.ts`.
 *
 * `channel` is always `email` - the only channel the backend sends on today
 * (integration.notify.smtp; the resolvers default it the same way).
 */

/** The one shape `notificationPreferences` returns for the calling person and channel. */
export interface NotificationPreferences {
  readonly channel: string;
  readonly unsubscribed: boolean;
  readonly digestWindowMinutes: number | null;
}

/** The same refusal-to-throw rule `modules/api/tasks.ts` applies to every failed Result. */
const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(result.reason, result.code ? { cause: new Error(result.code) } : undefined);
  }
  return result.data;
};

const NOTIFICATION_PREFERENCES_DOCUMENT =
  'query { notificationPreferences { channel unsubscribed digestWindowMinutes } }';

/** The caller's own notification preferences for the email channel; a missing or expired token
 * surfaces as a thrown refusal, same as `listTasks`. */
export const readNotificationPreferences = async (token: string): Promise<NotificationPreferences> => {
  return unwrap(await graphql<NotificationPreferences>(NOTIFICATION_PREFERENCES_DOCUMENT, undefined, token));
};

const UPDATE_NOTIFICATION_PREFERENCES_DOCUMENT =
  'mutation UpdateNotificationPreferences($input: UpdateNotificationPreferencesInput!) { updateNotificationPreferences(input: $input) { channel unsubscribed digestWindowMinutes } }';

/** Persists the email digest preference the owner toggled; the backend answers with the saved row. */
export const updateNotificationPreferences = async (token: string, unsubscribed: boolean): Promise<NotificationPreferences> => {
  return unwrap(
    await graphql<NotificationPreferences>(UPDATE_NOTIFICATION_PREFERENCES_DOCUMENT, { input: { channel: 'email', unsubscribed } }, token),
  );
};

const UNSUBSCRIBE_DOCUMENT =
  'mutation Unsubscribe($input: UnsubscribeInput!) { unsubscribe(input: $input) { channel unsubscribed } }';

/** fr.notify.unsubscribe: stops the email channel outright for the person `token` resolves to -
 * the same mutation whether the token came from the signed-in session or from an email link. */
export const unsubscribeFromEmail = async (token: string): Promise<NotificationPreferences> => {
  const result = unwrap(
    await graphql<{ channel: string; unsubscribed: boolean }>(UNSUBSCRIBE_DOCUMENT, { input: { channel: 'email' } }, token),
  );
  return { channel: result.channel, unsubscribed: result.unsubscribed, digestWindowMinutes: null };
};

/** Sign out ends the server session; clearing local state stays with the caller. */
export const endSession = async (token: string): Promise<boolean> => {
  return signOut(token);
};
