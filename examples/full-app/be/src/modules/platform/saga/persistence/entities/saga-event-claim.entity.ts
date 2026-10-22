import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("saga_event_claims")
/** One row per event a saga has taken: the pair (source, event id) is unique, so a redelivery is recognised. */
export class SagaEventClaimEntity {
    /** The saga the event moves, `saga:<name>`. */
    @PrimaryColumn({ name: "source", type: "varchar", length: 200 })
    source!: string

    /** The event id the producer supplied. */
    @PrimaryColumn({ name: "event_id", type: "varchar", length: 200 })
    eventId!: string

    /** When the event was taken. */
    @Column({ name: "claimed_at", type: "timestamptz" })
    claimedAt!: Date
}
