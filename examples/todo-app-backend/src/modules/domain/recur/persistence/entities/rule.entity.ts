import { Column, Entity, PrimaryColumn } from "typeorm"
import type { RuleFrequency } from "../../recur.contracts"

@Entity("recurrence_rules")
/** One recurrence rule: the owner is bound at creation and never rewritten, endedAt once set is never cleared. */
export class RuleEntity {
    /** The rule id. */
    @PrimaryColumn({ name: "id", type: "text" })
    id!: string

    /** The person who owns the rule. */
    @Column({ name: "owner", type: "text" })
    owner!: string

    /** The title of the tasks the rule creates. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** The recurrence shape. */
    @Column({ name: "frequency", type: "text" })
    frequency!: RuleFrequency

    /** The interval in days, set only for every-n-days. */
    @Column({ name: "n", type: "integer", nullable: true })
    n!: number | null

    /** The day of month, set only for monthly-day. */
    @Column({ name: "day_of_month", type: "integer", nullable: true })
    dayOfMonth!: number | null

    /** The IANA zone. */
    @Column({ name: "time_zone", type: "text" })
    timeZone!: string

    /** The local time HH:MM. */
    @Column({ name: "time", type: "text" })
    time!: string

    /** The first date, YYYY-MM-DD. */
    @Column({ name: "start_date", type: "text" })
    startDate!: string

    /** The local date the rule ended on. */
    @Column({ name: "ended_at", type: "text", nullable: true })
    endedAt!: string | null
}
