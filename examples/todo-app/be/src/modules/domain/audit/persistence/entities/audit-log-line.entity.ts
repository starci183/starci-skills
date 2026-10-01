import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("audit_log_lines")
/**
 * One append-only, hash-chained line per tracked action. The id is the chain position (never reused, never reordered).
 * The actor is sealed under the key named by keyId; once an erasure destroys that key the actor is unreadable while the
 * line, its position and its hash never change.
 */
export class AuditLogLineEntity {
    /** The chain position; a bigint comes back as a string. */
    @PrimaryGeneratedColumn("increment", { name: "id", type: "bigint" })
    id!: string

    /** When the action happened. */
    @Column({ name: "at", type: "timestamptz" })
    at!: Date

    /** The action label. */
    @Column({ name: "action", type: "text" })
    action!: string

    /** What the action touched, null when nothing. */
    @Column({ name: "target", type: "text", nullable: true })
    target!: string | null

    /** The opaque id of the key that seals the actor. */
    @Column({ name: "key_id", type: "text" })
    keyId!: string

    /** The acting person id, sealed. */
    @Column({ name: "actor", type: "text" })
    actor!: string

    /** The hash of the previous line, or the genesis marker. */
    @Column({ name: "prev_hash", type: "text" })
    prevHash!: string

    /** The hash of this line. */
    @Column({ name: "hash", type: "text" })
    hash!: string
}
