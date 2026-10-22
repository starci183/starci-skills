/** Supplies the notifier identity shared by validated transfer notices. */
export abstract class SepayTransferMapper {
    /** The notifier's numeric identifier for the transfer. */
    abstract readonly id: number

    /** The inbox identity of this delivery, stable across notifier retries. */
    get eventId(): string {
        return String(this.id)
    }
}
