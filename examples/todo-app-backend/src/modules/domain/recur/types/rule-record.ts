import type {
    RuleFrequency 
} from "../calendar.util"

/** data.recur.rule, as the service layer's own shape (mirrors RuleEntity field-for-field). */
export class RuleRecord {
    constructor(
    readonly id: string,
    readonly owner: string,
    public title: string,
    public frequency: RuleFrequency,
    public n: number | null,
    public dayOfMonth: number | null,
    public timeZone: string,
    public time: string,
    readonly startDate: string,
    public endedAt: string | null,
    ) {}
}
