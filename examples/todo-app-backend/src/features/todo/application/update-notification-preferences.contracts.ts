import type { NotifyErrorCode } from "@modules/domain/notify"
import type { Outcome } from "@modules/platform/primitives"
import type { NotificationPreferences } from "./notification-preferences.contracts"

/** What changing the preferences takes; an omitted field keeps its current value. */
export interface UpdateNotificationPreferencesRequest {
    /** The channel. */
    readonly channel: string
    /** The new opt-out flag. */
    readonly unsubscribed?: boolean | undefined
    /** The new digest window in minutes. */
    readonly digestWindowMinutes?: number | undefined
}

/** The stored preferences after the write, or the refusal that names why nothing was written. */
export type UpdateNotificationPreferencesResult = Outcome<NotificationPreferences, NotifyErrorCode>
