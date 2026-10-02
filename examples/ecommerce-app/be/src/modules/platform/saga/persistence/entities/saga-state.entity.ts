import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm"

@Entity("saga_states")
@Unique("uq_saga_states_saga_correlation", ["saga", "correlationId"])
/** The persisted state of one saga run: one row per (saga, correlation id), moved only through its version. */
export class SagaStateEntity {
    /** The row id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The saga. */
    @Column({ name: "saga", type: "varchar", length: 100 })
    saga!: string

    /** What the saga is about, kept as an id only. */
    @Column({ name: "correlation_id", type: "varchar", length: 200 })
    correlationId!: string

    /** The status; a varchar with a CHECK in the migration, not a native enum. */
    @Column({ name: "status", type: "varchar", length: 16 })
    status!: "running" | "compensating" | "compensated" | "completed"

    /** The fence of the row. */
    @Column({ name: "version", type: "int" })
    version!: number

    /** When the row last moved. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
