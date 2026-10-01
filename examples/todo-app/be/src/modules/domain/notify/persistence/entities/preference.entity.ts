import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("notify_preferences")
/** The preference of one person on one channel: at most one row per pair. No row reads as the default. */
export class NotifyPreferenceEntity {
    /** The person. */
    @PrimaryColumn({ name: "person_id", type: "text" })
    personId!: string

    /** The channel. */
    @PrimaryColumn({ name: "channel", type: "text" })
    channel!: string

    /** True when the person opted out of the channel. */
    @Column({ name: "unsubscribed", type: "boolean" })
    unsubscribed!: boolean

    /** The digest window override in minutes, null for the default. */
    @Column({ name: "digest_window_minutes", type: "integer", nullable: true })
    digestWindowMinutes!: number | null
}
