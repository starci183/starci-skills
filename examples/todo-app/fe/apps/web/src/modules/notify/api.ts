import { isRecord, parseOutcome, request, unwrap } from "@/modules/api"

/**
 * The notify feature's transport adapter: the GraphQL documents the backend already serves
 * (`notificationPreferences`, `updateNotificationPreferences` and `unsubscribe`). `channel` is always
 * `email` - the only channel the backend sends on today (integration.notify.smtp; the resolvers
 * default it the same way).
 */

/** The one shape `notificationPreferences` returns for the calling person and channel. */
interface NotificationPreferences {
    readonly channel: string
    readonly unsubscribed: boolean
    readonly digestWindowMinutes: number | null
}

/** The digest window of a wire row: a number of minutes, or `null` when none is set. */
const toDigestWindow = (value: unknown): number | null => (typeof value === "number" ? value : null)

/** The preferences of a payload, or `null` when the payload is not that shape. */
const toPreferences = (data: unknown): NotificationPreferences | null =>
    isRecord(data) && typeof data.channel === "string" && typeof data.unsubscribed === "boolean"
        ? {
              channel: data.channel,
              unsubscribed: data.unsubscribed,
              digestWindowMinutes: toDigestWindow(data.digestWindowMinutes),
          }
        : null

/**
 * The caller's own notification preferences for the email channel; a missing or expired token
 * surfaces as a thrown refusal, same as `listTasks`.
 */
export const readNotificationPreferences = async (token: string): Promise<NotificationPreferences> =>
    unwrap(parseOutcome(await request({ operation: "NotificationPreferences", token }), toPreferences))

/** Persists the email digest preference the owner toggled; the backend answers with the saved row. */
export const updateNotificationPreferences = async (
    token: string,
    unsubscribed: boolean,
): Promise<NotificationPreferences> =>
    unwrap(
        parseOutcome(
            await request({
                operation: "UpdateNotificationPreferences",
                variables: { input: { channel: "email", unsubscribed } },
                token,
            }),
            toPreferences,
        ),
    )

/**
 * fr.notify.unsubscribe: stops the email channel outright for the person `token` resolves to - the
 * same mutation whether the token came from the signed-in session or from an email link.
 */
export const unsubscribeFromEmail = async (token: string): Promise<NotificationPreferences> =>
    unwrap(
        parseOutcome(
            await request({ operation: "Unsubscribe", variables: { input: { channel: "email" } }, token }),
            toPreferences,
        ),
    )
