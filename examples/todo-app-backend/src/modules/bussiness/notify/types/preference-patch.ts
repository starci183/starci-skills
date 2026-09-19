/**
 * The partial update `PreferencesService.update` applies to a (personId, channel) preference row: each
 * present field overwrites, each omitted field keeps its current (or default) value - so a caller
 * changing only the digest window never has to resend the unsubscribed flag.
 */
export interface PreferencePatch {
    unsubscribed?: boolean;
    digestWindowMinutes?: number | null;
}
