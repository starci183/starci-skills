import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("sessions")
/** One row per live session; expiry is enforced on read and lapsed rows are purged by a job. */
export class SessionEntity {
    /** The opaque bearer token. */
    @PrimaryColumn({ name: "token", type: "text" })
    token!: string

    /** The person the session belongs to. */
    @Column({ name: "person_id", type: "text" })
    personId!: string

    /** When the session was issued. */
    @Column({ name: "issued_at", type: "timestamptz" })
    issuedAt!: Date

    /** When the session lapses. */
    @Column({ name: "expires_at", type: "timestamptz" })
    expiresAt!: Date
}
