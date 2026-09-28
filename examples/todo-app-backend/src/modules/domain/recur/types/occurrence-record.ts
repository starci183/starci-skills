/** Type alias naming the occurrence status set occurrence-record switches on; a new member is added here once, not scattered as literals. */
export type OccurrenceStatus = "materialised" | "completed" | "skipped" | "orphaned";

/**
 * data.recur.occurrence, as the service layer's own shape: the base data.task.task fields (id, owner,
 * title, complete, completedAt) joined with the occurrence-only fields (ruleId, windowKey, localDate,
 * dueAtUtc, status). "scheduled" is never a value of `status` here - sds.recur.occurrence-lifecycle's
 * own point that a scheduled occurrence is not a row at all.
 */
export class OccurrenceRecord {
    constructor(
    readonly id: string,
    readonly owner: string,
    public title: string,
    public complete: boolean,
    public completedAt: Date | null,
    readonly ruleId: string,
    readonly windowKey: string,
    readonly localDate: string,
    readonly dueAtUtc: Date,
    public status: OccurrenceStatus,
    ) {}
}
