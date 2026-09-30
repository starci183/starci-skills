import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("job_leases")
/** One row per leased resource: who holds it, until when, and the fencing token of the current grant. */
export class LeaseEntity {
    /** The name of the protected resource. */
    @PrimaryColumn({ name: "name", type: "varchar", length: 200 })
    name!: string

    /** The identity of the current holder. */
    @Column({ name: "holder", type: "varchar", length: 200 })
    holder!: string

    /** The fencing token of the current grant. */
    @Column({ name: "fence", type: "bigint" })
    fence!: string

    /** The instant the lease lapses when it is not renewed. */
    @Column({ name: "expires_at", type: "timestamptz" })
    expiresAt!: Date
}
