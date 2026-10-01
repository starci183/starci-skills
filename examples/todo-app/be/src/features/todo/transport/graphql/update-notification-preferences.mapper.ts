import type { NotificationPreferencesResult } from "../../application/notification-preferences.contracts"
import type { UpdateNotificationPreferencesRequest } from "../../application/update-notification-preferences.contracts"
import type { UpdateNotificationPreferencesInput } from "./dto/update-notification-preferences.input"
import type { UpdateNotificationPreferencesType } from "./dto/update-notification-preferences.type"

/** Maps the GraphQL input to the command request; an omitted field stays omitted. */
export const toUpdateNotificationPreferencesRequest = (
    input: UpdateNotificationPreferencesInput,
): UpdateNotificationPreferencesRequest => ({
    channel: input.channel,
    unsubscribed: input.unsubscribed,
    digestWindowMinutes: input.digestWindowMinutes,
})

/** Maps the stored preferences to the GraphQL type. */
export const toUpdateNotificationPreferencesType = (
    preferences: NotificationPreferencesResult,
): UpdateNotificationPreferencesType => ({
    channel: preferences.channel,
    unsubscribed: preferences.unsubscribed,
    digestWindowMinutes: preferences.digestWindowMinutes,
})
