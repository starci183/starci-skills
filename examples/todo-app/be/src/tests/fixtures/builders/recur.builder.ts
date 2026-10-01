import { builder } from "@starci/jest-preset"

/** The columns of a stored row, declared here so a spec never reaches into the persistence of the owner. */
export interface RecurOccurrenceRow {
    id: string
    ruleId: string
    windowKey: string
    localDate: string
    dueAtUtc: Date
    status: "materialised" | "completed" | "skipped" | "orphaned"
}

/** A stored occurrence t1 of rule r1, materialised for the window of 2026-09-02. */
export const occurrenceRow = builder<RecurOccurrenceRow>({
    id: "t1",
    ruleId: "r1",
    windowKey: "r1:2026-09-02",
    localDate: "2026-09-02",
    dueAtUtc: new Date("2026-09-02T02:00:00.000Z"),
    status: "materialised",
})
