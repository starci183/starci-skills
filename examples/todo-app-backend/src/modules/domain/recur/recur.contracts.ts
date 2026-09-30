import type { EntityManager } from "typeorm"

/** The recurrence shapes a rule can take: weekday-only, an N-day interval, or a fixed day of month. */
export enum RuleFrequency {
    /** Fires once per weekday (Monday to Friday) at the rule time; weekends are skipped. */
    EveryWeekday = "every-weekday",
    /** Fires every `n` calendar days counting from the start date; requires `n`. */
    EveryNDays = "every-n-days",
    /** Fires once per month on `dayOfMonth`, skipping the months that lack the day; requires `dayOfMonth`. */
    MonthlyDay = "monthly-day",
}

/** The lifecycle states of a materialised occurrence; a scheduled occurrence is not a row at all. */
export type OccurrenceStatus = "materialised" | "completed" | "skipped" | "orphaned"

/** Why a rule submission has the wrong shape for its frequency. */
export type RuleShapeProblem = "n-required" | "n-forbidden" | "day-of-month-required" | "day-of-month-forbidden"

/** The fields of a rule the calendar walks: the interval or day inputs plus the anchor date. */
export interface CalendarRuleShape {
    /** The recurrence shape. */
    readonly frequency: RuleFrequency
    /** The interval in days, set only for every-n-days. */
    readonly n: number | null
    /** The day of month, set only for monthly-day. */
    readonly dayOfMonth: number | null
    /** The first date the rule can fire on, YYYY-MM-DD. */
    readonly startDate: string
}

/** A wall-clock local date and time inside an IANA zone. */
export interface LocalDateTime {
    /** The year. */
    readonly year: number
    /** The month, 1 to 12. */
    readonly month: number
    /** The day of month. */
    readonly day: number
    /** The hour, 0 to 23. */
    readonly hour: number
    /** The minute, 0 to 59. */
    readonly minute: number
}

/** How a local time maps to UTC: `gap` and `fold` are the DST edges. */
export type ZoneResolutionKind = "normal" | "gap" | "fold"

/** The UTC instant a local time resolves to, plus which DST edge case the resolution took. */
export interface ZoneResolution {
    /** The instant. */
    readonly instant: Date
    /** Which edge case the resolution took. */
    readonly kind: ZoneResolutionKind
}

/** A recurrence rule as callers see it. */
export interface RuleView {
    /** The rule id. */
    readonly id: string
    /** The person who owns the rule; bound at creation and never rewritten. */
    readonly owner: string
    /** The title of the tasks the rule creates. */
    readonly title: string
    /** The recurrence shape. */
    readonly frequency: RuleFrequency
    /** The interval in days, set only for every-n-days. */
    readonly n: number | null
    /** The day of month, set only for monthly-day. */
    readonly dayOfMonth: number | null
    /** The IANA zone the rule time is read in. */
    readonly timeZone: string
    /** The local time HH:MM the rule fires at. */
    readonly time: string
    /** The first date the rule can fire on, YYYY-MM-DD. */
    readonly startDate: string
    /** The local date the rule ended on, null while it runs; once set it is never cleared. */
    readonly endedAt: string | null
}

/** A materialised occurrence as callers see it: the id is the id of the task it spawned. */
export interface OccurrenceView {
    /** The occurrence id, the same as the id of its task. */
    readonly id: string
    /** The rule it belongs to. */
    readonly ruleId: string
    /** The identity of the window, `<ruleId>:<localDate>`; unique across all occurrences. */
    readonly windowKey: string
    /** The local date the occurrence is due on, YYYY-MM-DD. */
    readonly localDate: string
    /** The UTC instant it is due at. */
    readonly dueAtUtc: Date
    /** The lifecycle state. */
    readonly status: OccurrenceStatus
}

/** One occurrence a rule owes and has not materialised yet. */
export interface DueOccurrence {
    /** The rule it belongs to. */
    readonly ruleId: string
    /** The owner of the rule, who will own the task. */
    readonly ownerId: string
    /** The title of the task to create. */
    readonly title: string
    /** The identity of the window, `<ruleId>:<localDate>`. */
    readonly windowKey: string
    /** The local date the occurrence is due on. */
    readonly localDate: string
    /** The UTC instant it is due at. */
    readonly dueAtUtc: Date
}

/** What collecting the due occurrences needs. */
export interface CollectDueParams {
    /** The tick instant: "today" is read from it in the zone of each rule. */
    readonly now: Date
    /** The most occurrences to return; the rest wait for the next tick. */
    readonly limit: number
}

/** What creating a rule needs; the write joins the caller transaction. */
export interface CreateRuleParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The person who will own the rule. */
    readonly ownerId: string
    /** The title of the tasks the rule creates. */
    readonly title: string
    /** The recurrence shape. */
    readonly frequency: RuleFrequency
    /** The interval in days, for every-n-days. */
    readonly n: number | null
    /** The day of month, for monthly-day. */
    readonly dayOfMonth: number | null
    /** The IANA zone. */
    readonly timeZone: string
    /** The local time HH:MM. */
    readonly time: string
    /** The first date, YYYY-MM-DD. */
    readonly startDate: string
}

/** The fields an edit may change; an absent field keeps its value, an explicit null clears n or dayOfMonth. */
export interface RulePatch {
    /** The new recurrence shape. */
    readonly frequency?: RuleFrequency
    /** The new interval. */
    readonly n?: number | null
    /** The new day of month. */
    readonly dayOfMonth?: number | null
    /** The new zone. */
    readonly timeZone?: string
    /** The new local time. */
    readonly time?: string
}

/** What editing a rule needs; the write joins the caller transaction. */
export interface EditRuleParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The rule id. */
    readonly id: string
    /** The person who asks; only the owner may edit. */
    readonly actorId: string
    /** The changes. */
    readonly patch: RulePatch
}

/** What ending a rule needs; the write joins the caller transaction. */
export interface EndRuleParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The rule id. */
    readonly id: string
    /** The person who asks; only the owner may end. */
    readonly actorId: string
    /** The local date the rule ends on, YYYY-MM-DD. */
    readonly endedAt: string
}

/** What reading one rule needs. */
export interface FindRuleParams {
    /** The rule id. */
    readonly id: string
}

/** What reading one batch of rules needs: the batch that follows the given rule id. */
export interface ListRulesParams {
    /** The last rule id of the previous batch, null for the first batch. */
    readonly after: string | null
}

/** What materialising one occurrence needs; the write joins the caller transaction. */
export interface MaterialiseParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The id of the task already created for this occurrence. */
    readonly id: string
    /** The rule it belongs to. */
    readonly ruleId: string
    /** The identity of the window. */
    readonly windowKey: string
    /** The local date it is due on. */
    readonly localDate: string
    /** The UTC instant it is due at. */
    readonly dueAtUtc: Date
}

/** What completing or skipping an occurrence needs; the writes join the caller transaction. */
export interface TransitionOccurrenceParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The occurrence id. */
    readonly id: string
    /** The person who asks; only the owner of the task may act. */
    readonly actorId: string
    /** The instant of the transition. */
    readonly at: Date
}

/** What orphaning the occurrences of an ended rule needs; the write joins the caller transaction. */
export interface OrphanOccurrencesParams {
    /** The transaction manager of the caller. */
    readonly manager: EntityManager
    /** The rule that ended. */
    readonly ruleId: string
    /** The local date it ended on. */
    readonly endedAt: string
}

/** What listing the occurrences of one rule needs. */
export interface ListOccurrencesParams {
    /** The rule id. */
    readonly ruleId: string
}

/** What checking which windows are already materialised needs. */
export interface ExistingWindowKeysParams {
    /** The window keys to check. */
    readonly windowKeys: ReadonlyArray<string>
}
