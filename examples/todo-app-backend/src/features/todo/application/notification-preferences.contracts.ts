/** What reading the preferences takes: the channel. */
export interface NotificationPreferencesRequest {
    /** The channel. */
    readonly channel: string
}

/** The preferences of the caller on one channel: the stored ones, or the defaults when nothing was ever written. */
export interface NotificationPreferencesResult {
    /** The channel. */
    readonly channel: string
    /** True when the caller opted out of the channel. */
    readonly unsubscribed: boolean
    /** The digest window override in minutes, null for the default. */
    readonly digestWindowMinutes: number | null
}
