import { Column, Entity, PrimaryColumn } from "typeorm"
import type { OccurrenceStatus } from "../../recur.contracts"

@Entity("occurrences")
/** The occurrence half of a task: the id is the id of the task the occurrence spawned, which holds the owner, title and completion. */
export class OccurrenceEntity {
    /** The occurrence id, the same as the task id. */
    @PrimaryColumn({ name: "id", type: "text" })
    id!: string

    /** The rule it belongs to. */
    @Column({ name: "rule_id", type: "text" })
    ruleId!: string

    /** The identity of the window, unique across all occurrences. */
    @Column({ name: "window_key", type: "text" })
    windowKey!: string

    /** The local date it is due on. */
    @Column({ name: "local_date", type: "text" })
    localDate!: string

    /** The UTC instant it is due at. */
    @Column({ name: "due_at_utc", type: "timestamptz" })
    dueAtUtc!: Date

    /** The lifecycle state. */
    @Column({ name: "status", type: "text" })
    status!: OccurrenceStatus
}
