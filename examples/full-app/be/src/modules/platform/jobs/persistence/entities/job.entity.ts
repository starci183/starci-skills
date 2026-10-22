import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity("jobs")
/** One background job: its fencing token is bumped by the claim only, and every other write carries the token it holds. */
export class JobEntity {
    /** The id of the job. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The kind of the job: the queue its processor consumes. */
    @Column({ name: "kind", type: "varchar", length: 200 })
    kind!: string

    /** The key of the delivery (the BullMQ job id); unique, so a repeated delivery meets the same row. */
    @Column({ name: "job_key", type: "varchar", length: 200, unique: true })
    jobKey!: string

    /** The state of the job: running, failed or done. */
    @Column({ name: "status", type: "varchar", length: 16 })
    status!: "running" | "failed" | "done"

    /** The last step a worker recorded. */
    @Column({ name: "current_step", type: "varchar", length: 200, nullable: true })
    currentStep!: string | null

    /** The fencing token: it only grows, one per claim. */
    @Column({ name: "fencing_token", type: "bigint" })
    fencingToken!: string

    /** The worker that holds the claim, for operators. */
    @Column({ name: "claimed_by", type: "varchar", length: 200, nullable: true })
    claimedBy!: string | null

    /** When the claim expires; after it a stalled job may be claimed again. */
    @Column({ name: "lease_expires_at", type: "timestamptz", nullable: true })
    leaseExpiresAt!: Date | null

    /** The payload of the job: ids, never an entity. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: object

    /** Why the last delivery failed. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** When the job was first claimed. */
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date

    /** When the row last changed. */
    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date
}
