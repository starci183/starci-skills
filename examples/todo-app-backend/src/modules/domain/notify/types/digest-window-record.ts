/** The digest-window bookkeeping row (see notify-digest-window.entity.ts's comment), read out of
 * NotifyDigestWindowEntity. */
export class DigestWindowRecord {
    constructor(
    readonly id: string,
    readonly personId: string,
    readonly channel: string,
    readonly opensAt: Date,
    readonly closesAt: Date,
    public flushedAt: Date | null,
    ) {}
}
