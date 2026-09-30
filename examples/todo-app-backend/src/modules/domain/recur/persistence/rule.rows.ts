import type { RuleView } from "../recur.contracts"
import type { RuleEntity } from "./entities/rule.entity"

/** Maps a rule row to the view callers get. */
export const toRuleView = (row: RuleEntity): RuleView => ({
    id: row.id,
    owner: row.owner,
    title: row.title,
    frequency: row.frequency,
    n: row.n,
    dayOfMonth: row.dayOfMonth,
    timeZone: row.timeZone,
    time: row.time,
    startDate: row.startDate,
    endedAt: row.endedAt,
})
