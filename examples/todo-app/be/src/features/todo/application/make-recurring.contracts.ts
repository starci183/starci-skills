import type { RecurErrorCode, RuleFrequency } from "@modules/domain/recur"
import type { Outcome } from "@modules/platform/primitives"

/** What making a recurrence rule takes. */
export interface MakeRecurringRequest {
    /** The title of the tasks the rule creates. */
    readonly title: string
    /** The recurrence shape. */
    readonly frequency: RuleFrequency
    /** The interval in days, required for every-n-days and absent otherwise. */
    readonly n: number | null
    /** The day of month from 1 to 31, required for monthly-day and absent otherwise. */
    readonly dayOfMonth: number | null
    /** The IANA zone the time is read in. */
    readonly timeZone: string
    /** The local time HH:MM the rule fires at. */
    readonly time: string
    /** The first date the rule can fire on, YYYY-MM-DD. */
    readonly startDate: string
}

/** The rule that was created. */
export interface MadeRecurring {
    /** The new rule id. */
    readonly ruleId: string
    /** The stored title. */
    readonly title: string
    /** The recurrence shape. */
    readonly frequency: RuleFrequency
    /** The IANA zone. */
    readonly timeZone: string
    /** The local time. */
    readonly time: string
    /** The first date. */
    readonly startDate: string
}

/** The created rule, or the refusal that names why nothing was written. */
export type MakeRecurringResult = Outcome<MadeRecurring, RecurErrorCode>
