import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("notify_digest_windows")
/** One rolling digest window of a person and a channel, from the first admitted event until it is flushed. */
export class NotifyDigestWindowEntity {
    /** The window id, also the digest group id of its notifications. */
    @PrimaryColumn({ name: "id", type: "text" })
    id!: string

    /** The person the window belongs to. */
    @Column({ name: "person_id", type: "text" })
    personId!: string

    /** The channel the window collects for. */
    @Column({ name: "channel", type: "text" })
    channel!: string

    /** When the window opened. */
    @Column({ name: "opens_at", type: "timestamptz" })
    opensAt!: Date

    /** When the window closes; its content is read then, never at open. */
    @Column({ name: "closes_at", type: "timestamptz" })
    closesAt!: Date

    /** When the window was flushed, null while it is open. */
    @Column({ name: "flushed_at", type: "timestamptz", nullable: true })
    flushedAt!: Date | null
}
