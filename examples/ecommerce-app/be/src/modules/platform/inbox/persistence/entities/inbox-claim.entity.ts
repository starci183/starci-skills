import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("inbox_claims")
/** One row per event a consumer or webhook has claimed: the pair (source, event id) is unique. */
export class InboxClaimEntity {
    /** The consumer queue or webhook the event arrived through. */
    @PrimaryColumn({ name: "source", type: "varchar", length: 200 })
    source!: string

    /** The event id the provider or producer supplied. */
    @PrimaryColumn({ name: "event_id", type: "varchar", length: 200 })
    eventId!: string

    /** When the event was claimed. */
    @Column({ name: "claimed_at", type: "timestamptz" })
    claimedAt!: Date
}
