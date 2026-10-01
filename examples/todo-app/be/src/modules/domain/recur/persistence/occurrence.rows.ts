import type { OccurrenceView } from "../recur.contracts"
import type { OccurrenceEntity } from "./entities/occurrence.entity"

/** Maps an occurrence row to the view callers get. */
export const toOccurrenceView = (row: OccurrenceEntity): OccurrenceView => ({
    id: row.id,
    ruleId: row.ruleId,
    windowKey: row.windowKey,
    localDate: row.localDate,
    dueAtUtc: row.dueAtUtc,
    status: row.status,
})

/** The number of rows an UPDATE touched: TypeORM answers `[rows, rowCount]` for an UPDATE, so anything else counts as none. */
export const toAffectedCount = (result: unknown): number => {
    if (!Array.isArray(result)) return 0
    const count: unknown = result[1]
    return typeof count === "number" ? count : 0
}
