import type { RecurFrequency, ScheduleRefusal } from "@/modules/types"

/**
 * The wire name each domain frequency travels under. The backend registers RecurFrequencyInput
 * under the GraphQL name `RecurFrequency` without a valuesMap, so the schema's enum literals are
 * the TypeScript keys (verified against the live endpoint) while data.recur.rule.frequency keeps
 * the kebab-case domain values the radios, the rule record and the summary all speak.
 */
export const WIRE_FREQUENCY: Record<RecurFrequency, string> = {
    "every-weekday": "EveryWeekday",
    "every-n-days": "EveryNDays",
    "monthly-day": "MonthlyDay",
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/
const DAY_OF_MONTH_PATTERN = /^([1-9]|[12]\d|3[01])$/

/** The local calendar date in the rule's own zone, shaped YYYY-MM-DD for endRecurrence. */
export const todayInZone = (timeZone: string): string => {
    const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
    const part = (type: string) => parts.find(entry => entry.type === type)?.value ?? ""
    return `${part("year")}-${part("month")}-${part("day")}`
}

/** The make-recurring form's draft: every field as the owner typed it, before validation. */
type ScheduleDraft = {
  readonly frequency: RecurFrequency;
  readonly n: string;
  readonly dayOfMonth: string;
  readonly time: string;
  readonly timeZone: string;
  readonly startDate: string;
};

/** The refusal sentence for each field the draft validation can fail, resolved from `recur`. */
type ScheduleDraftRefusalMessages = {
  readonly n: string;
  readonly dayOfMonth: string;
  readonly time: string;
  readonly timeZone: string;
  readonly startDate: string;
};

/** fr.recur.make-recurring's draft validation, in the form's field order; first failure wins. This
 * owner knows which field failed; the sentences arrive resolved, because the words are the
 * dictionary's. */
export const validateDraft = (draft: ScheduleDraft, messages: ScheduleDraftRefusalMessages): ScheduleRefusal | null => {
    if (draft.frequency === "every-n-days" && !POSITIVE_INTEGER_PATTERN.test(draft.n)) {
        return { field: "n", message: messages.n }
    }
    if (draft.frequency === "monthly-day" && !DAY_OF_MONTH_PATTERN.test(draft.dayOfMonth)) {
        return { field: "dayOfMonth", message: messages.dayOfMonth }
    }
    if (!TIME_PATTERN.test(draft.time)) return { field: "time", message: messages.time }
    if (draft.timeZone.trim() === "") return { field: "timeZone", message: messages.timeZone }
    if (!DATE_PATTERN.test(draft.startDate)) return { field: "startDate", message: messages.startDate }
    return null
}
