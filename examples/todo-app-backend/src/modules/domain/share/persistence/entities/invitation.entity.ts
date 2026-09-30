import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("invitations")
/**
 * One invitation: one row per (task, email) pair at a time. personId is null until the invited person accepts. Expiry
 * is never stored by a sweep: a pending row past its window reads as expired.
 */
export class InvitationEntity {
    /** The invitation id. */
    @PrimaryColumn({ name: "id", type: "text" })
    id!: string

    /** The task the invitation is on. */
    @Column({ name: "task_id", type: "text" })
    taskId!: string

    /** The person who owns the task and sent the invitation. */
    @Column({ name: "owner_id", type: "text" })
    ownerId!: string

    /** The invited address, trimmed and lower-cased. */
    @Column({ name: "email", type: "text" })
    email!: string

    /** The granted role: viewer or editor. */
    @Column({ name: "role", type: "text" })
    role!: string

    /** The stored status: pending, accepted or revoked (expired is derived on read). */
    @Column({ name: "status", type: "text" })
    status!: string

    /** When the invitation was sent, or sent again. */
    @Column({ name: "sent_at", type: "timestamptz" })
    sentAt!: Date

    /** When the invitee accepted, null until then. */
    @Column({ name: "accepted_at", type: "timestamptz", nullable: true })
    acceptedAt!: Date | null

    /** When the owner revoked, null until then. */
    @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
    revokedAt!: Date | null

    /** The person bound by accepting, null until then. */
    @Column({ name: "person_id", type: "text", nullable: true })
    personId!: string | null
}
