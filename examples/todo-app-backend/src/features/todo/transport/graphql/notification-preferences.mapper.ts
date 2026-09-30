import { NOTIFY_CHANNEL_EMAIL } from "@modules/domain/notify"
import type {
    NotificationPreferencesResult,
    NotificationPreferencesRequest,
} from "../../application/notification-preferences.contracts"
import type { NotificationPreferencesInput } from "./dto/notification-preferences.input"
import type { NotificationPreferencesType } from "./dto/notification-preferences.type"

/** Maps the optional GraphQL input to the query request; the channel is email when omitted. */
export const toNotificationPreferencesRequest = (
    input: NotificationPreferencesInput | undefined,
): NotificationPreferencesRequest => ({ channel: input?.channel ?? NOTIFY_CHANNEL_EMAIL })

/** Maps the stored preferences to the GraphQL type. */
export const toNotificationPreferencesType = (preferences: NotificationPreferencesResult): NotificationPreferencesType => ({
    channel: preferences.channel,
    unsubscribed: preferences.unsubscribed,
    digestWindowMinutes: preferences.digestWindowMinutes,
})
