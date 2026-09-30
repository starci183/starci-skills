import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("audit_erasure_requests")
/**
 * One erasure request. The request id is the opaque id every log line about the erasure names instead of the person;
 * the person id lives only here and is dropped in the same write that completes the request.
 */
export class AuditErasureRequestEntity {
    /** The opaque request id. */
    @PrimaryColumn({ name: "request_id", type: "text" })
    requestId!: string

    /** The subject, null once the request is complete. */
    @Column({ name: "person_id", type: "text", nullable: true })
    personId!: string | null

    /** The state: requested, verified, refused, executing or complete. */
    @Column({ name: "state", type: "text" })
    state!: string

    /** When the request was made. */
    @Column({ name: "requested_at", type: "timestamptz" })
    requestedAt!: Date

    /** When the subject was verified. */
    @Column({ name: "verified_at", type: "timestamptz", nullable: true })
    verifiedAt!: Date | null

    /** When the request was refused. */
    @Column({ name: "refused_at", type: "timestamptz", nullable: true })
    refusedAt!: Date | null

    /** When the key destruction started. */
    @Column({ name: "executing_at", type: "timestamptz", nullable: true })
    executingAt!: Date | null

    /** When the request completed. */
    @Column({ name: "completed_at", type: "timestamptz", nullable: true })
    completedAt!: Date | null
}
