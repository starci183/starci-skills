import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity("tasks")
/** One task: the owner is bound at creation and never rewritten; completedAt is set if and only if complete is true. */
export class TaskEntity {
    /** The task id. */
    @PrimaryColumn({ name: "id", type: "text" })
    id!: string

    /** The person who owns the task. */
    @Column({ name: "owner", type: "text" })
    owner!: string

    /** The title. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** Whether the task is complete. */
    @Column({ name: "complete", type: "boolean" })
    complete!: boolean

    /** When the task was completed, null while it is open. */
    @Column({ name: "completed_at", type: "timestamptz", nullable: true })
    completedAt!: Date | null
}
