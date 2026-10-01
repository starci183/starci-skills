import type { RecurErrorCode, RuleFrequency } from "@modules/domain/recur"
import type { Outcome } from "@modules/platform/primitives"

/** What editing a recurrence rule takes: the rule and any of the fields to change; an absent field keeps its value. */
export interface EditRecurrenceRequest {
    /** The rule id. */
    readonly ruleId: string
    /** The new recurrence shape. */
    readonly frequency?: RuleFrequency
    /** The new interval in days; null clears it. */
    readonly n?: number | null
    /** The new day of month; null clears it. */
    readonly dayOfMonth?: number | null
    /** The new IANA zone. */
    readonly timeZone?: string
    /** The new local time HH:MM. */
    readonly time?: string
}

/** The rule after the edit. */
export interface EditedRecurrence {
    /** The rule id. */
    readonly ruleId: string
    /** The recurrence shape. */
    readonly frequency: RuleFrequency
    /** The IANA zone. */
    readonly timeZone: string
    /** The local time. */
    readonly time: string
}

/** The rule after the edit, or the refusal that names why it was not touched. */
export type EditRecurrenceResult = Outcome<EditedRecurrence, RecurErrorCode>
