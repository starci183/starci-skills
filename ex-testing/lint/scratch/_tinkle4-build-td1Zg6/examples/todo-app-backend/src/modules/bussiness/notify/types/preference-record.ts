/** data.notify.preference, read out of NotifyPreferenceEntity, or the default when no row exists yet. */
export class PreferenceRecord {
    constructor(
    readonly personId: string,
    readonly channel: string,
    public unsubscribed: boolean,
    public digestWindowMinutes: number | null,
    ) {}
}
